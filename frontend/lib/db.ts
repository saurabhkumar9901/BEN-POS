import { DuckDBInstance } from "@duckdb/node-api";
import { cached } from "./cache";
import { viewStatements } from "./views";

// Two read paths, same queries:
//   local      :memory: + views over Parquet/CSV files (offline dev, current default)
//   motherduck :memory: + ATTACH md: (Vercel + MotherDuck free tier)
// Set DATA_SOURCE=motherduck plus MOTHERDUCK_TOKEN (+ MD_DATABASE) to switch.
// The token is server-only (never NEXT_PUBLIC_). Local benpos.duckdb is only
// ever touched by the Python pipeline, so rebuilds can't collide with browsing.

// Connection pool: a few warm in-memory instances shared across requests.
// POOL_MIN instances are never evicted, so the pool stays warm across idle
// gaps (previously every idle instance was destroyed after ~120s and the
// next visitor paid a full cold start). Tune with BENPOS_POOL / BENPOS_POOL_MIN.
const POOL_MAX = Math.max(1, Number(process.env.BENPOS_POOL ?? 4) || 4);
const POOL_MIN = Math.min(
  POOL_MAX,
  Math.max(1, Number(process.env.BENPOS_POOL_MIN ?? 2) || 2)
);
const POOL_IDLE_TICKS = 12; // 12 x 10s with no checkout before shrinking to POOL_MIN
const KEEPALIVE_TICKS = 6; // idle protected instance gets SELECT 1 every ~60s

type Pooled = {
  instance: Awaited<ReturnType<typeof DuckDBInstance.create>>;
  con: Awaited<ReturnType<Awaited<ReturnType<typeof DuckDBInstance.create>>["connect"]>>;
  inUse: boolean;
  idleTicks: number;
  keepaliveTicks: number;
};

type PoolState = {
  pool: Pooled[];
  waiters: { resolve: (p: Pooled) => void; reject: (e: unknown) => void }[];
};

// Survive dev HMR / Turbopack module re-evaluation: otherwise every edit
// drops all warm instances and the next page load is cold again.
const g = globalThis as Record<string, unknown>;
const state: PoolState =
  (g.__benposPool as PoolState | undefined) ??
  ((g.__benposPool as PoolState) = { pool: [], waiters: [] });
const pool = state.pool;
const waiters = state.waiters;

async function createPooled(): Promise<Pooled> {
  const instance = await DuckDBInstance.create(":memory:");
  const con = await instance.connect();
  try {
    if ((process.env.DATA_SOURCE ?? "local") === "motherduck") {
      const token = process.env.MOTHERDUCK_TOKEN;
      if (!token) throw new Error("MOTHERDUCK_TOKEN env is required for DATA_SOURCE=motherduck");
      const db = process.env.MD_DATABASE ?? "benpos";
      // Serverless homes aren't writable; keep downloaded extensions in /tmp.
      await con.run("SET extension_directory TO '/tmp/duckdb_extensions'");
      await con.run("INSTALL motherduck");
      await con.run("LOAD motherduck");
      await con.run(`SET motherduck_token='${token.replace(/'/g, "''")}'`);
      await con.run(`ATTACH 'md:${db}' AS md`);
      await con.run("USE md.main");
    } else {
      for (const ddl of viewStatements()) {
        await con.run(ddl);
      }
    }
  } catch (err) {
    try {
      con.closeSync();
    } catch {
      /* ignore */
    }
    try {
      instance.closeSync();
    } catch {
      /* ignore */
    }
    throw err;
  }
  return { instance, con, inUse: true, idleTicks: 0, keepaliveTicks: 0 };
}

function destroyPooled(p: Pooled): void {
  try {
    p.con.closeSync();
  } catch {
    /* already closed */
  }
  try {
    p.instance.closeSync();
  } catch {
    /* already closed */
  }
}

async function acquire(): Promise<Pooled> {
  const free = pool.find((p) => !p.inUse);
  if (free) {
    free.inUse = true;
    free.idleTicks = 0;
    return free;
  }
  if (pool.length < POOL_MAX) {
    const p = await createPooled();
    pool.push(p);
    return p;
  }
  return new Promise<Pooled>((resolve, reject) => {
    waiters.push({ resolve, reject });
  });
}

function release(p: Pooled): void {
  const next = waiters.shift();
  if (next) {
    p.idleTicks = 0;
    p.keepaliveTicks = 0;
    next.resolve(p);
    return;
  }
  p.inUse = false;
  p.idleTicks = 0;
  p.keepaliveTicks = 0;
}

// Pre-warm POOL_MIN instances sequentially at boot (sequential to avoid a
// thunder of parallel DuckDB creates), then optionally pre-run the homepage
// queries so parquet metadata + the heavy leaders aggregation are hot before
// the first visitor. Fire-and-forget; failures surface on real queries.
// Disable query warm with BENPOS_WARM_QUERIES=0.
{
  if (g.__benposPoolWarm !== true) {
    g.__benposPoolWarm = true;
    (async () => {
      try {
        for (let i = 0; i < POOL_MIN; i++) {
          const p = await acquire();
          release(p);
        }
      } catch {
        /* first real query will retry */
        return;
      }
      if (process.env.BENPOS_WARM_QUERIES === "0") return;
      try {
        const q = await import("./queries");
        await Promise.all([
          q.snapshotDates().catch(() => []),
          q.overviewTotals().catch(() => null),
          q.listCompanies({ sort: "qty", dir: "desc", page: 1, pageSize: 50 }).catch(() => null),
          // Heaviest homepage query — warms parquet JOIN + aggregation.
          q.leaders(2, 10).catch(() => []),
        ]);
        // Warm the biggest company pages (topHolders + states) so first
        // visits don't pay cold scans. Sequential + top-2 only to bound
        // boot cost and pool contention.
        try {
          const top = await q
            .listCompanies({ sort: "qty", dir: "desc", page: 1, pageSize: 2 })
            .catch(() => null);
          const dates = await q.snapshotDates().catch(() => []);
          const d = dates[0];
          if (top && d) {
            for (const c of top.rows.slice(0, 2)) {
              await Promise.all([
                q.topHolders(c.isin, String(d), 25, 0, {}).catch(() => null),
                q.distinctCompanyStates(c.isin, String(d)).catch(() => []),
              ]);
            }
          }
        } catch {
          /* company warm is best-effort */
        }
      } catch {
        /* cold path still works, just slower once */
      }
    })();
  }
}

{
  if (g.__benposPoolSweep !== true) {
    g.__benposPoolSweep = true;
    setInterval(() => {
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        if (p.inUse) continue;
        p.idleTicks += 1;
        p.keepaliveTicks += 1;
        const protectedSlot = i < POOL_MIN;
        if (protectedSlot) {
          // Never evict the warm core. Periodic SELECT 1 keeps the DuckDB
          // connection + parquet file handles hot and detects a dead
          // instance early (replaced on next acquire).
          if (p.keepaliveTicks >= KEEPALIVE_TICKS) {
            p.keepaliveTicks = 0;
            p.inUse = true;
            p.con
              .run("SELECT 1")
              .catch(() => {
                const idx = pool.indexOf(p);
                if (idx >= 0) pool.splice(idx, 1);
                destroyPooled(p);
                // Replenish the warm core in the background.
                acquire()
                  .then((np) => release(np))
                  .catch(() => {});
              })
              .finally(() => {
                if (pool.includes(p)) {
                  p.inUse = false;
                  p.idleTicks = 0;
                }
              });
          }
          continue;
        }
        if (p.idleTicks >= POOL_IDLE_TICKS && pool.length > POOL_MIN) {
          pool.splice(i, 1);
          destroyPooled(p);
        }
      }
    }, 10_000);
  }
}

function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  // node-api DATE arrives as { days: number } (days since epoch)
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (typeof o.days === "number" && Object.keys(o).length === 1) {
      return new Date(o.days * 86400000).toISOString().slice(0, 10);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = toJsonSafe(v);
    return out;
  }
  if (Array.isArray(value)) return value.map(toJsonSafe);
  return value;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  // Long default is safe: the frontend never writes, and local ingest busts
  // the generation on every successful build-db. (Cross-process readers,
  // e.g. Vercel + MotherDuck, rely on TTL alone.) Per-call ttlMs overrides.
  ttlMs = 300_000
): Promise<T[]> {
  return cached<T[]>(`q:${sql}`, ttlMs, async () => {
    const p = await acquire();
    try {
      const reader = await p.con.runAndReadAll(sql);
      const rows = reader.getRowObjectsJS() as Record<string, unknown>[];
      return rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) out[k] = toJsonSafe(v);
        return out;
      }) as T[];
    } catch (err) {
      // Fresh/empty store (nothing ingested yet): degrade to empty results
      // so pages render their empty states instead of 500ing.
      const msg = err instanceof Error ? err.message : String(err);
      if (/no files found that match|does not exist|no such table|no such view/i.test(msg)) {
        console.warn(`[desk] empty store, returning []: ${msg.split("\n")[0]}`);
        return [] as T[];
      }
      throw err;
    } finally {
      release(p);
    }
  });
}

export function esc(value: string): string {
  return value.replace(/'/g, "''");
}
