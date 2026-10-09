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
// Pool size is small and fixed; idle instances are evicted on a timer.
const POOL_MAX = Math.max(1, Number(process.env.BENPOS_POOL ?? 4) || 4);
const POOL_IDLE_TICKS = 12; // 12 x 10s with no checkout before shrinking

type Pooled = {
  instance: Awaited<ReturnType<typeof DuckDBInstance.create>>;
  con: Awaited<ReturnType<Awaited<ReturnType<typeof DuckDBInstance.create>>["connect"]>>;
  inUse: boolean;
  idleTicks: number;
};

const pool: Pooled[] = [];
const waiters: { resolve: (p: Pooled) => void; reject: (e: unknown) => void }[] = [];

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
  return { instance, con, inUse: true, idleTicks: 0 };
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
    next.resolve(p);
    return;
  }
  p.inUse = false;
  p.idleTicks = 0;
}

{
  const g = globalThis as Record<string, unknown>;
  if (g.__benposPoolSweep !== true) {
    g.__benposPoolSweep = true;
    setInterval(() => {
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        if (p.inUse) continue;
        p.idleTicks += 1;
        if (p.idleTicks >= POOL_IDLE_TICKS && pool.length > 0) {
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
