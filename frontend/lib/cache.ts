// Tiny TTL cache for read-only analytics queries. The database only ever
// changes via ingest jobs in this same process, so invalidation is a
// generation counter bumped on every successful build-db (no stale reads,
// no manual expiry tuning per table).

type Entry = { value: unknown; expiresTick: number };

const store = new Map<string, Entry>();
const MAX_ENTRIES = 500;
const TICK_MS = 1000;

let generation = 0;
let nowTick = 0;
{
  const g = globalThis as Record<string, unknown>;
  if (g.__benposCacheSweep !== true) {
    g.__benposCacheSweep = true;
    setInterval(() => {
      nowTick += 1;
      if (store.size === 0) return;
      for (const [k, e] of store) {
        if (e.expiresTick <= nowTick) store.delete(k);
        if (store.size < MAX_ENTRIES) break;
      }
    }, TICK_MS);
  }
}

export function bustCache(): void {
  generation += 1;
  store.clear();
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const k = `${generation}:${key}`;
  const hit = store.get(k);
  if (hit && hit.expiresTick > nowTick) {
    // refresh LRU position
    store.delete(k);
    store.set(k, hit);
    return hit.value as T;
  }
  const value = await fn();
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(k, { value, expiresTick: nowTick + Math.max(1, Math.ceil(ttlMs / TICK_MS)) });
  return value;
}
