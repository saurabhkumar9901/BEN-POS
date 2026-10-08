import { esc, query } from "./db";
import { normSql } from "./geo";

export type CompanyRow = {
  benpos_date: string;
  isin: string;
  company_name: string | null;
  holder_count: number;
  clean_holder_count: number;
  total_qty: number;
  cdsl_holders: number;
  cdsl_qty: number;
  nsdl_holders: number;
  nsdl_qty: number;
  top10_qty: number;
  top10_pct: number;
  top50_qty: number;
  top50_pct: number;
  top100_qty: number;
  top100_pct: number;
};

export type HolderRow = {
  investor_key: string;
  name: string | null;
  qty: number;
  depo: string;
  identity_confidence: string | null;
};

export type PortfolioRow = {
  benpos_date: string;
  isin: string;
  company_name: string | null;
  depository: string;
  total_qty: number;
  validation_flags: string | null;
};

const SORTS: Record<string, string> = {
  holders: "holder_count",
  qty: "total_qty",
  top10: "top10_pct",
  name: "company_name",
  isin: "isin",
};

export async function listCompanies(opts: {
  q?: string;
  date?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: CompanyRow[]; total: number }> {
  const sort = SORTS[opts.sort ?? "holders"] ?? SORTS.holders;
  const dir = opts.dir === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
  const where: string[] = [];
  if (opts.date) where.push(`benpos_date = DATE '${esc(opts.date)}'`);
  if (opts.q) {
    const q = esc(opts.q.trim());
    where.push(`(company_name ILIKE '%${q}%' OR isin ILIKE '%${q}%')`);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM company_stats ${w}`
  ))[0]?.n ?? 0;
  const rows = await query<CompanyRow>(
    `SELECT * FROM company_stats ${w} ORDER BY ${sort} ${dir} ` +
      `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
  );
  return { rows, total };
}

export async function snapshotDates(): Promise<string[]> {
  const rows = await query<{ benpos_date: string }>(
    "SELECT DISTINCT benpos_date FROM company_stats ORDER BY benpos_date DESC"
  );
  return rows.map((r) => String(r.benpos_date));
}

export async function companyStats(isin: string, date?: string): Promise<CompanyRow | null> {
  const w = date
    ? `isin = '${esc(isin)}' AND benpos_date = DATE '${esc(date)}'`
    : `isin = '${esc(isin)}'`;
  const rows = await query<CompanyRow>(
    `SELECT * FROM company_stats WHERE ${w} ORDER BY benpos_date DESC LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function companyQuality(isin: string, date?: string) {
  const w = date
    ? `WHERE isin = '${esc(isin)}' AND benpos_date = DATE '${esc(date)}'`
    : `WHERE isin = '${esc(isin)}'`;
  const rows = await query<{
    rows: number;
    clean_rows: number;
    flagged_rows: number;
    count_match: boolean | null;
    qty_match: boolean | null;
  }>(
    `SELECT SUM(rows) AS rows, SUM(clean_rows) AS clean_rows, ` +
      `SUM(flagged_rows) AS flagged_rows, ` +
      `MIN(count_match) AS count_match, MIN(qty_match) AS qty_match ` +
      `FROM file_validation ${w}`
  );
  return rows[0] ?? null;
}

export async function caFactor(isin: string, date?: string): Promise<number | null> {
  const w = date
    ? `isin = '${esc(isin)}' AND benpos_date = DATE '${esc(date)}'`
    : `isin = '${esc(isin)}'`;
  const rows = await query<{ ca_factor: number }>(
    `SELECT ca_factor FROM ca_snapshot_factors WHERE ${w} ` +
      `ORDER BY benpos_date DESC LIMIT 1`
  );
  return rows[0]?.ca_factor ?? null;
}

export async function topHolders(
  isin: string,
  date: string,
  limit = 50,
  offset = 0,
  filters: { q?: string; depo?: string; minQty?: number; state?: string } = {}
): Promise<{ rows: HolderRow[]; total: number }> {
  const w = [`isin = '${esc(isin)}'`, `benpos_date = DATE '${esc(date)}'`];
  if (filters.q?.trim()) {
    w.push(`holder1 ILIKE '%${esc(filters.q.trim())}%'`);
  }
  if (filters.depo === "cdsl" || filters.depo === "nsdl") {
    w.push(`depository = '${filters.depo}'`);
  }
  if (filters.state) {
    w.push(`${normSql()} = '${esc(filters.state)}'`);
  }
  const having =
    filters.minQty && filters.minQty > 0 ? `HAVING SUM(total_qty) >= ${Math.floor(filters.minQty)}` : "";
  const where = `WHERE ${w.join(" AND ")}`;
  const grouped = `SELECT investor_key FROM holdings_display ${where} GROUP BY investor_key ${having}`;
  const total = (await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (${grouped})`
  ))[0]?.n ?? 0;
  const rows = await query<HolderRow>(
    `SELECT investor_key, MAX(holder1) AS name, SUM(total_qty) AS qty, ` +
      `STRING_AGG(DISTINCT depository, '+') AS depo, ` +
      `MAX(identity_confidence) AS identity_confidence ` +
      `FROM holdings_display ${where} GROUP BY investor_key ${having} ` +
      `ORDER BY qty DESC NULLS LAST, investor_key LIMIT ${limit} OFFSET ${offset}`
  );
  return { rows, total };
}

export async function searchShareholders(q: string, limit = 50) {
  const needle = esc(q.trim());
  if (needle.length < 2) return [];
  return query<{
    investor_key: string;
    name: string | null;
    n_companies: number;
    total_qty: number;
    identity_confidence: string | null;
  }>(
    `SELECT investor_key, MAX(holder1) AS name, ` +
      `COUNT(DISTINCT isin) AS n_companies, SUM(total_qty) AS total_qty, ` +
      `MAX(identity_confidence) AS identity_confidence ` +
      `FROM holdings_display WHERE holder1 ILIKE '%${needle}%' OR investor_key = '${needle}' ` +
      `GROUP BY investor_key ORDER BY total_qty DESC NULLS LAST LIMIT ${Math.min(200, limit)}`
  );
}

export async function shareholderProfile(key: string) {
  const k = esc(key);
  const portfolio = await query<PortfolioRow>(
    `SELECT benpos_date, isin, MAX(company_name) AS company_name, ` +
      `STRING_AGG(DISTINCT depository, '+') AS depository, ` +
      `SUM(total_qty) AS total_qty, ` +
      `NULLIF(STRING_AGG(DISTINCT NULLIF(validation_flags, ''), ';'), '') AS validation_flags ` +
      `FROM holdings_display WHERE investor_key = '${k}' ` +
      `GROUP BY benpos_date, isin ORDER BY benpos_date DESC, total_qty DESC NULLS LAST`
  );
  const identity = await query<{
    investor_key: string;
    name: string | null;
    identity_confidence: string | null;
    key_type: string | null;
  }>(
    `SELECT investor_key, MAX(holder1) AS name, ` +
      `MAX(identity_confidence) AS identity_confidence, MAX(key_type) AS key_type ` +
      `FROM holdings_display WHERE investor_key = '${k}' GROUP BY investor_key`
  );
  return { identity: identity[0] ?? null, portfolio };
}

export type LeaderRow = {
  investor_key: string;
  name: string | null;
  n_companies: number;
  n_positions: number;
  total_qty: number;
  identity_confidence: string | null;
};

export async function leaders(minCompanies = 2, limit = 100): Promise<LeaderRow[]> {
  // n_positions = rows (safe view drops account_id, so account counts stay in DB views)
  return query<LeaderRow>(
    `SELECT investor_key, MAX(holder1) AS name, COUNT(DISTINCT isin) AS n_companies, ` +
      `COUNT(*) AS n_positions, ` +
      `SUM(total_qty) AS total_qty, MAX(identity_confidence) AS identity_confidence ` +
      `FROM holdings_display GROUP BY investor_key ` +
      `HAVING COUNT(DISTINCT isin) >= ${Math.max(1, minCompanies)} ` +
      `ORDER BY n_companies DESC, total_qty DESC NULLS LAST, investor_key LIMIT ${Math.min(500, limit)}`
  );
}

export type HoldingRow = {
  investor_key: string;
  holder: string | null;
  isin: string;
  company_name: string | null;
  depository: string;
  total_qty: number;
  state_norm: string;
  validation_flags: string | null;
};

export type HoldingsFilter = {
  isin?: string;
  depo?: string;
  state?: string;
  minQty?: number;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
};

const HOLD_SORTS: Record<string, string> = {
  qty: "total_qty",
  holder: "holder1",
  company: "company_name",
};

export type OverviewTotals = {
  positions: number;
  identities: number;
  crossCompany: number;
  fullBreadth: number;
  nCompanies: number;
  filesReconciled: number;
  latestDate: string | null;
  cdslPositions: number;
  nsdlPositions: number;
};

export async function overviewTotals(): Promise<OverviewTotals> {
  const [pos, ident, cross, full, comp, files, mix] = await Promise.all([
    query<{ n: number }>("SELECT COUNT(*) AS n FROM holdings_display"),
    query<{ n: number }>("SELECT COUNT(DISTINCT investor_key) AS n FROM holdings_display"),
    query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM (SELECT investor_key FROM holdings_display " +
        "GROUP BY investor_key HAVING COUNT(DISTINCT isin) >= 2)"
    ),
    query<{ n: number; c: number }>(
      "SELECT COUNT(*) AS n, MAX(c) AS c FROM (SELECT investor_key, " +
        "COUNT(DISTINCT isin) AS c FROM holdings_display GROUP BY investor_key) " +
        "WHERE c = (SELECT COUNT(DISTINCT isin) FROM holdings_display)"
    ),
    query<{ n: number; d: string }>(
      "SELECT COUNT(DISTINCT isin) AS n, MAX(benpos_date) AS d FROM holdings_display"
    ),
    query<{ n: number }>("SELECT COUNT(*) AS n FROM manifest"),
    query<{ cdsl: number; nsdl: number }>(
      "SELECT SUM(cdsl_holders) AS cdsl, SUM(nsdl_holders) AS nsdl FROM company_stats"
    ),
  ]);
  return {
    positions: pos[0]?.n ?? 0,
    identities: ident[0]?.n ?? 0,
    crossCompany: cross[0]?.n ?? 0,
    fullBreadth: full[0]?.n ?? 0,
    nCompanies: comp[0]?.n ?? 0,
    filesReconciled: files[0]?.n ?? 0,
    latestDate: comp[0]?.d ? String(comp[0].d) : null,
    cdslPositions: mix[0]?.cdsl ?? 0,
    nsdlPositions: mix[0]?.nsdl ?? 0,
  };
}

/** Deterministic accent per ISIN for company cards. */
const ACCENTS = ["lime", "orange", "blue", "pink"] as const;
export function companyAccent(isin: string): (typeof ACCENTS)[number] {
  let h = 0;
  for (let i = 0; i < isin.length; i++) h = (h * 31 + isin.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export type PositionRow = {
  depository: string;
  total_qty: number;
  free_qty: number | null;
  pledged_qty: number | null;
  nsdl_bucket_sum: number | null;
  holder1: string | null;
  jh_name: string | null;
  dob: string | null;
  acc_status: string | null;
  acc_category: string | null;
  acc_type: string | null;
  acc_subtype: string | null;
  occup_code: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  micr: string | null;
  ifsc: string | null;
  account_suffix: string | null;
  address_full: string | null;
  pin: string | null;
  pan_reported: boolean | null;
  has_email: boolean | null;
  has_phone: boolean | null;
  validation_flags: string | null;
  source_file: string;
  source_row: number;
};

export async function positionDetail(
  key: string,
  isin: string,
  date?: string
): Promise<PositionRow[]> {
  const w =
    `investor_key = '${esc(key)}' AND isin = '${esc(isin)}'` +
    (date ? ` AND benpos_date = DATE '${esc(date)}'` : "");
  return query<PositionRow>(
    `SELECT depository, total_qty, free_qty, pledged_qty, nsdl_bucket_sum, ` +
      `holder1, jh_name, dob, acc_status, acc_category, acc_type, acc_subtype, occup_code, ` +
      `bank_name, bank_branch, micr, ifsc, RIGHT(account_no, 4) AS account_suffix, ` +
      `address_full, pin, pan_reported, has_email, has_phone, ` +
      `validation_flags, source_file, source_row ` +
      `FROM position_detail WHERE ${w} ORDER BY total_qty DESC NULLS LAST`
  );
}

export async function distinctStates(): Promise<{ state: string; n: number }[]> {
  return query<{ state: string; n: number }>(
    `SELECT ${normSql()} AS state, COUNT(*) AS n FROM holdings_display ` +
      `GROUP BY 1 ORDER BY 2 DESC`
  );
}

export async function distinctCompanyStates(
  isin: string,
  date: string
): Promise<{ state: string; n: number }[]> {
  return query<{ state: string; n: number }>(
    `SELECT ${normSql()} AS state, COUNT(*) AS n FROM holdings_display ` +
      `WHERE isin = '${esc(isin)}' AND benpos_date = DATE '${esc(date)}' ` +
      `GROUP BY 1 ORDER BY 2 DESC`
  );
}

export async function holdingsExplorer(f: HoldingsFilter): Promise<{ rows: HoldingRow[]; total: number }> {
  const where: string[] = [];
  if (f.isin) where.push(`isin = '${esc(f.isin)}'`);
  if (f.depo === "cdsl" || f.depo === "nsdl") where.push(`depository = '${f.depo}'`);
  if (f.minQty && f.minQty > 0) where.push(`total_qty >= ${Math.floor(f.minQty)}`);
  const norm = normSql();
  if (f.state) where.push(`${norm} = '${esc(f.state)}'`);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sort = HOLD_SORTS[f.sort ?? "qty"] ?? "total_qty";
  const dir = f.dir === "asc" ? "ASC" : "DESC";
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 50));
  const page = Math.max(1, f.page ?? 1);
  const total = (await query<{ n: number }>(`SELECT COUNT(*) AS n FROM holdings_display ${w}`))[0]?.n ?? 0;
  const rows = await query<HoldingRow>(
    `SELECT investor_key, holder1 AS holder, isin, company_name, depository, ` +
      `total_qty, ${norm} AS state_norm, validation_flags ` +
      `FROM holdings_display ${w} ORDER BY ${sort} ${dir} NULLS LAST ` +
      `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
  );
  return { rows, total };
}
