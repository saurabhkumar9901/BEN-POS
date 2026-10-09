import fs from "node:fs";
import path from "node:path";

// File-less reads: each pooled instance is `:memory:` plus views over the
// immutable Parquet store and precomputed CSVs. The frontend never opens
// benpos.duckdb, so `build-db` (writer) can't collide with browsing.
// View definitions mirror src/benpos/db.py — keep both in sync.

export function processedRoot(): string {
  return path.resolve(process.cwd(), "..", "processed").split(path.sep).join("/");
}

function has(rel: string): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), "..", "processed", rel));
  } catch {
    return false;
  }
}

type Probe = { uni: boolean; safe: boolean; fullNsdl: boolean; fullCdsl: boolean };
let probeCache: Probe | null = null;
let stmtsCache: string[] | null = null;

/** Bust the memoized filesystem probe (called on successful build-db). */
export function bustViewCache(): void {
  probeCache = null;
  stmtsCache = null;
}

// Single directory walk for all parquet kinds. Previously globExists() walked
// the whole processed tree up to 6x per pooled connection creation
// (up to 24 walks on a cold 4-slot boot). Now: 1 walk, memoized.
function probe(): Probe {
  if (probeCache) return probeCache;
  const out: Probe = { uni: false, safe: false, fullNsdl: false, fullCdsl: false };
  const root = path.join(process.cwd(), "..", "processed");
  try {
    for (const dateDir of fs.readdirSync(root, { withFileTypes: true })) {
      if (!dateDir.isDirectory() || !dateDir.name.startsWith("benpos_date=")) continue;
      const d = path.join(root, dateDir.name);
      for (const isinDir of fs.readdirSync(d, { withFileTypes: true })) {
        if (!isinDir.isDirectory() || !isinDir.name.startsWith("isin=")) continue;
        const files = fs.readdirSync(path.join(d, isinDir.name));
        for (const f of files) {
          if (f === "depository=nsdl_full.parquet") out.fullNsdl = true;
          else if (f === "depository=cdsl_full.parquet") out.fullCdsl = true;
          else if (f.endsWith("_unified_safe.parquet")) out.safe = true;
          else if (f.endsWith("_unified.parquet")) out.uni = true;
        }
        if (out.uni && out.safe && out.fullNsdl && out.fullCdsl) break;
      }
      if (out.uni && out.safe && out.fullNsdl && out.fullCdsl) break;
    }
  } catch {
    /* no processed tree yet */
  }
  probeCache = out;
  return out;
}

/** Ordered DDL statements to run on every fresh in-memory instance. */
export function viewStatements(): string[] {
  if (stmtsCache) return stmtsCache;
  const root = processedRoot();
  const uni = `${root}/benpos_date=*/isin=*/depository=*_unified.parquet`;
  const safe = `${root}/benpos_date=*/isin=*/depository=*_unified_safe.parquet`;
  const fullNsdl = `${root}/benpos_date=*/isin=*/depository=nsdl_full.parquet`;
  const fullCdsl = `${root}/benpos_date=*/isin=*/depository=cdsl_full.parquet`;
  const p = probe();
  const stmts: string[] = [
    `CREATE OR REPLACE VIEW holdings AS SELECT * FROM read_parquet('${uni}', hive_partitioning = false)`,
  ];
  if (p.safe) {
    stmts.push(
      `CREATE OR REPLACE VIEW holdings_safe AS SELECT * FROM read_parquet('${safe}', hive_partitioning = false)`,
      "CREATE OR REPLACE VIEW holdings_display AS " +
        "SELECT s.isin, s.company_name, s.depository, s.benpos_date, " +
        "RTRIM(h.holder1, '. ') AS holder1, RTRIM(h.holder2, '. ') AS holder2, " +
        "RTRIM(h.holder3, '. ') AS holder3, h.name_norm, " +
        "s.investor_key, s.key_type, s.identity_confidence, s.pin, s.ifsc, " +
        "s.total_qty, s.free_qty, s.holding_type, s.state_code, " +
        "s.validation_flags, s.source_file, s.source_row " +
        "FROM holdings_safe s JOIN holdings h USING (source_file, source_row)"
    );
  }
  if (p.fullNsdl) {
    stmts.push(
      `CREATE OR REPLACE VIEW holdings_full_nsdl AS SELECT * FROM read_parquet('${fullNsdl}', hive_partitioning = false)`
    );
  }
  if (p.fullCdsl) {
    stmts.push(
      `CREATE OR REPLACE VIEW holdings_full_cdsl AS SELECT * FROM read_parquet('${fullCdsl}', hive_partitioning = false)`
    );
  }
  if (p.safe && p.fullNsdl && p.fullCdsl) {
    stmts.push(
      "CREATE OR REPLACE VIEW position_detail AS " +
        "SELECT d.*, " +
        "CASE WHEN d.depository = 'nsdl' THEN RTRIM(fn.holder2, '. ') ELSE RTRIM(fc.holder2, '. ') END AS jh_name, " +
        "CASE WHEN d.depository = 'nsdl' THEN NULL ELSE CAST(fc.dob AS VARCHAR) END AS dob, " +
        "CASE WHEN d.depository = 'nsdl' THEN NULL ELSE fc.status END AS acc_status, " +
        "CASE WHEN d.depository = 'nsdl' THEN NULL ELSE fc.category END AS acc_category, " +
        "CASE WHEN d.depository = 'nsdl' THEN NULL ELSE fc.holder_type END AS acc_type, " +
        "CASE WHEN d.depository = 'nsdl' THEN NULL ELSE fc.holder_subtype END AS acc_subtype, " +
        "CASE WHEN d.depository = 'nsdl' THEN NULL ELSE fc.occup_code END AS occup_code, " +
        "COALESCE(fn.bank_name, fc.bank_name) AS bank_name, " +
        "COALESCE(fn.bank_branch, fc.bank_branch) AS bank_branch, " +
        "COALESCE(fn.micr, fc.micr) AS micr, " +
        "CASE WHEN d.depository = 'nsdl' THEN fn.dp_id || fn.client_id ELSE fc.boid END AS account_no, " +
        "CASE WHEN d.depository = 'nsdl' THEN " +
        "CONCAT_WS(' ', NULLIF(fn.addr1, ''), NULLIF(fn.addr2, ''), NULLIF(fn.addr3, ''), NULLIF(fn.addr_city, '')) " +
        "ELSE CONCAT_WS(' ', NULLIF(fc.perm_addr1, ''), NULLIF(fc.perm_addr2, ''), NULLIF(fc.perm_addr3, ''), NULLIF(fc.perm_addr4, ''), NULLIF(fc.perm_state, ''), NULLIF(fc.perm_country, '')) END AS address_full, " +
        "CASE WHEN d.depository = 'nsdl' THEN (fn.pan1 IS NOT NULL) ELSE (fc.pan1 IS NOT NULL) END AS pan_reported, " +
        "CASE WHEN d.depository = 'nsdl' THEN (fn.email1 IS NOT NULL) ELSE (fc.email IS NOT NULL) END AS has_email, " +
        "CASE WHEN d.depository = 'nsdl' THEN (fn.phone IS NOT NULL AND fn.phone <> '') ELSE (fc.mobile IS NOT NULL AND fc.mobile <> '') END AS has_phone, " +
        "CASE WHEN d.depository = 'nsdl' THEN NULL ELSE CAST(fc.pledge_qty AS BIGINT) END AS pledged_qty, " +
        "CASE WHEN d.depository = 'nsdl' THEN " +
        "(ABS(CAST(fn.qty_b01 AS BIGINT)) + ABS(CAST(fn.qty_b02 AS BIGINT)) + ABS(CAST(fn.qty_b03 AS BIGINT)) + ABS(CAST(fn.qty_b04 AS BIGINT)) + ABS(CAST(fn.qty_b05 AS BIGINT)) + ABS(CAST(fn.qty_b06 AS BIGINT)) + ABS(CAST(fn.qty_b07 AS BIGINT)) + ABS(CAST(fn.qty_b08 AS BIGINT)) + ABS(CAST(fn.qty_b09 AS BIGINT)) + ABS(CAST(fn.qty_b10 AS BIGINT)) + ABS(CAST(fn.qty_b11 AS BIGINT))) " +
        "ELSE NULL END AS nsdl_bucket_sum " +
        "FROM holdings_display d " +
        "LEFT JOIN holdings_full_nsdl fn ON d.depository = 'nsdl' AND d.source_file = fn.source_file AND d.source_row = fn.source_row " +
        "LEFT JOIN holdings_full_cdsl fc ON d.depository = 'cdsl' AND d.source_file = fc.source_file AND d.source_row = fc.source_row"
    );
  }
  if (has("company_stats.csv")) {
    stmts.push(
      `CREATE OR REPLACE VIEW company_stats AS SELECT * FROM read_csv('${root}/company_stats.csv', header = true)`
    );
  }
  if (has("overview_stats.csv")) {
    stmts.push(
      `CREATE OR REPLACE VIEW overview_stats AS SELECT * FROM read_csv('${root}/overview_stats.csv', header = true)`
    );
  }
  if (has("_manifest.csv")) {
    stmts.push(
      `CREATE OR REPLACE VIEW manifest AS SELECT * FROM read_csv('${root}/_manifest.csv', header = true)`
    );
  }
  if (has("validation_report.csv")) {
    stmts.push(
      `CREATE OR REPLACE VIEW file_validation AS SELECT * FROM read_csv('${root}/validation_report.csv', header = true)`
    );
  }
  if (has("ca_events.csv")) {
    stmts.push(
      `CREATE OR REPLACE VIEW ca_events AS SELECT * FROM read_csv('${root}/ca_events.csv', header = true)`
    );
  }
  if (has("ca_snapshot_factors.csv")) {
    stmts.push(
      `CREATE OR REPLACE VIEW ca_snapshot_factors AS SELECT * FROM read_csv('${root}/ca_snapshot_factors.csv', header = true)`
    );
  }
  stmtsCache = stmts;
  return stmts;
}
