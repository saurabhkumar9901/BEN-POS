"""DuckDB query layer over the immutable Parquet store (BRD Sec 9 + 10).

Parquet stays the append-only asset; benpos.duckdb holds:
  holdings  VIEW  union of all *_unified.parquet (columns live in-data,
                  so no Hive extraction quirks from filenames)
  manifest  VIEW  processed/_manifest.csv
  file_validation VIEW processed/validation_report.csv
  company_stats TABLE per (benpos_date, isin): counts, depository mix,
                  top-10/50/100 concentration. Rebuilt by partition keys
                  (delete + insert) so weekly re-runs stay idempotent.
"""
from __future__ import annotations

from pathlib import Path

DB_NAME = "benpos.duckdb"

STATS_DDL = """
CREATE TABLE IF NOT EXISTS company_stats (
    benpos_date DATE,
    isin VARCHAR,
    company_name VARCHAR,
    holder_count BIGINT,
    clean_holder_count BIGINT,
    total_qty BIGINT,
    cdsl_holders BIGINT,
    cdsl_qty BIGINT,
    nsdl_holders BIGINT,
    nsdl_qty BIGINT,
    top10_qty BIGINT,
    top10_pct DOUBLE,
    top50_qty BIGINT,
    top50_pct DOUBLE,
    top100_qty BIGINT,
    top100_pct DOUBLE
)
"""

# One row per investor-company-date; top-N over summed investor qty.
STATS_QUERY = """
WITH inv AS (
    SELECT benpos_date, isin,
           MAX(company_name) AS company_name,
           investor_key,
           SUM(total_qty) AS q,
           SUM(CASE WHEN depository = 'cdsl' THEN 1 ELSE 0 END) AS is_cdsl,
           SUM(CASE WHEN depository = 'nsdl' THEN 1 ELSE 0 END) AS is_nsdl,
           SUM(CASE WHEN depository = 'cdsl' THEN total_qty ELSE 0 END) AS q_cdsl,
           SUM(CASE WHEN depository = 'nsdl' THEN total_qty ELSE 0 END) AS q_nsdl,
           MIN(CASE WHEN validation_flags = '' THEN 1 ELSE 0 END) AS all_clean
    FROM holdings
    GROUP BY benpos_date, isin, investor_key
),
ranked AS (
    SELECT benpos_date, isin, company_name, q, is_cdsl, is_nsdl,
           q_cdsl, q_nsdl, all_clean,
           ROW_NUMBER() OVER (PARTITION BY benpos_date, isin ORDER BY q DESC) AS rn,
           COUNT(*) OVER (PARTITION BY benpos_date, isin) AS n,
           SUM(q) OVER (PARTITION BY benpos_date, isin) AS tot
    FROM inv
)
SELECT benpos_date, isin, MAX(company_name) AS company_name,
       MAX(n) AS holder_count,
       SUM(all_clean) AS clean_holder_count,
       MAX(tot) AS total_qty,
       SUM(is_cdsl) AS cdsl_holders,
       SUM(q_cdsl) AS cdsl_qty,
       SUM(is_nsdl) AS nsdl_holders,
       SUM(q_nsdl) AS nsdl_qty,
       SUM(CASE WHEN rn <= 10 THEN q END) AS top10_qty,
       SUM(CASE WHEN rn <= 10 THEN q END) * 100.0 / NULLIF(MAX(tot), 0) AS top10_pct,
       SUM(CASE WHEN rn <= 50 THEN q END) AS top50_qty,
       SUM(CASE WHEN rn <= 50 THEN q END) * 100.0 / NULLIF(MAX(tot), 0) AS top50_pct,
       SUM(CASE WHEN rn <= 100 THEN q END) AS top100_qty,
       SUM(CASE WHEN rn <= 100 THEN q END) * 100.0 / NULLIF(MAX(tot), 0) AS top100_pct
FROM ranked
GROUP BY benpos_date, isin
"""


LOCK_RE = ("already open", "being used by another process", "could not obtain lock", "lock timeout")
LOCK_DELAY = 10


def _is_lock_error(err: Exception) -> bool:
    msg = str(err).lower()
    return any(t in msg for t in LOCK_RE)


def connect(out_root: str, *, wait: int = 0):
    """Open benpos.duckdb. With wait>0, retry the writer lock for ~wait seconds.

    A reader (frontend page load) holds the file for milliseconds; the writer
    backs off 10s at a time instead of dying on first collision.
    """
    import time

    import duckdb

    attempts = max(1, -(-wait // LOCK_DELAY)) if wait else 1
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            return duckdb.connect(str(Path(out_root) / DB_NAME))
        except Exception as err:  # noqa: BLE001 - inspected, re-raised
            if not wait or not _is_lock_error(err):
                raise
            last = err
            print(f"DB locked by a reader - retrying in {LOCK_DELAY}s "
                  f"({attempts - 1 - attempt} left)...", flush=True)
            time.sleep(LOCK_DELAY)
    assert last is not None
    raise last


def build_db(out_root: str, ca_path: str | None = None,
             company_map: str | None = None, wait: int = 0) -> str:
    """(Re)create views + refresh company_stats (+ CA tables when --ca given).

    wait>0: retry the writer lock instead of dying (see connect()).
    """
    import duckdb  # noqa: F401  (ensures dependency present)

    root = Path(out_root)
    abs_root = root.resolve().as_posix()  # views must survive any client CWD
    con = connect(out_root, wait=wait)
    try:
        uni_glob = f"{abs_root}/benpos_date=*/isin=*/depository=*_unified.parquet"
        safe_glob = f"{abs_root}/benpos_date=*/isin=*/depository=*_unified_safe.parquet"
        con.execute(
            "CREATE OR REPLACE VIEW holdings AS "
            f"SELECT * FROM read_parquet('{uni_glob}', hive_partitioning = false)"
        )
        if list(root.glob("benpos_date=*/isin=*/depository=*_unified_safe.parquet")):
            con.execute(
                "CREATE OR REPLACE VIEW holdings_safe AS "
                f"SELECT * FROM read_parquet('{safe_glob}', hive_partitioning = false)"
            )
            # Display view: safe columns, but real holder names.
            # PAN / account / phone / email / bank / address stay suppressed.
            con.execute(
                "CREATE OR REPLACE VIEW holdings_display AS "
                "SELECT s.isin, s.company_name, s.depository, s.benpos_date, "
                "RTRIM(h.holder1, '. ') AS holder1, RTRIM(h.holder2, '. ') AS holder2, "
                "RTRIM(h.holder3, '. ') AS holder3, h.name_norm, "
                "s.investor_key, s.key_type, s.identity_confidence, s.pin, s.ifsc, "
                "s.total_qty, s.free_qty, s.holding_type, s.state_code, "
                "s.validation_flags, s.source_file, s.source_row "
                "FROM holdings_safe s JOIN holdings h "
                "USING (source_file, source_row)"
            )
            # Full-detail views: every source field, per depository (schemas differ).
            nsdl_full_glob = f"{abs_root}/benpos_date=*/isin=*/depository=nsdl_full.parquet"
            cdsl_full_glob = f"{abs_root}/benpos_date=*/isin=*/depository=cdsl_full.parquet"
            if list(root.glob("benpos_date=*/isin=*/depository=nsdl_full.parquet")):
                con.execute(
                    "CREATE OR REPLACE VIEW holdings_full_nsdl AS "
                    f"SELECT * FROM read_parquet('{nsdl_full_glob}', hive_partitioning = false)"
                )
            if list(root.glob("benpos_date=*/isin=*/depository=cdsl_full.parquet")):
                con.execute(
                    "CREATE OR REPLACE VIEW holdings_full_cdsl AS "
                    f"SELECT * FROM read_parquet('{cdsl_full_glob}', hive_partitioning = false)"
                )
            # Position-detail view: one row per account-position with every
            # drawer parameter (pan/account/contact stay masked or boolean).
            con.execute(
                "CREATE OR REPLACE VIEW position_detail AS "
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
                "FROM holdings_display d "
                "LEFT JOIN holdings_full_nsdl fn ON d.depository = 'nsdl' AND d.source_file = fn.source_file AND d.source_row = fn.source_row "
                "LEFT JOIN holdings_full_cdsl fc ON d.depository = 'cdsl' AND d.source_file = fc.source_file AND d.source_row = fc.source_row"
            )
        # Cross-depository keys: same investor in NSDL + CDSL of one company-date.
        con.execute(
            "CREATE OR REPLACE VIEW xdp_holders AS "
            "SELECT benpos_date, isin, MAX(company_name) AS company_name, "
            "investor_key, MAX(holder1) AS name, SUM(total_qty) AS total_qty, "
            "COUNT(*) AS rows, STRING_AGG(DISTINCT depository, '+') AS depo "
            "FROM holdings GROUP BY benpos_date, isin, investor_key "
            "HAVING COUNT(DISTINCT depository) = 2"
        )
        # Multi-account: one identity, 2+ demat accounts in the same file.
        con.execute(
            "CREATE OR REPLACE VIEW multi_accounts AS "
            "SELECT benpos_date, isin, depository, investor_key, "
            "MAX(holder1) AS name, COUNT(DISTINCT account_id) AS n_accounts, "
            "SUM(total_qty) AS total_qty "
            "FROM holdings GROUP BY benpos_date, isin, depository, investor_key "
            "HAVING COUNT(DISTINCT account_id) > 1"
        )
        # Manual-review queue: low-confidence identities with source trace.
        con.execute(
            "CREATE OR REPLACE VIEW identity_review AS "
            "SELECT benpos_date, isin, depository, investor_key, holder1, "
            "name_norm, pan1, pin, total_qty, account_id, "
            "source_file, source_row "
            "FROM holdings WHERE identity_confidence = 'low'"
        )
        man = f"{abs_root}/_manifest.csv"
        con.execute(
            "CREATE OR REPLACE VIEW manifest AS "
            f"SELECT * FROM read_csv('{man}', header = true)"
        )
        if Path(root / "validation_report.csv").exists():
            rep = f"{abs_root}/validation_report.csv"
            con.execute(
                "CREATE OR REPLACE VIEW file_validation AS "
                f"SELECT * FROM read_csv('{rep}', header = true)"
            )
        if ca_path:
            _build_ca(con, root, ca_path, company_map)
        con.execute(STATS_DDL)
        con.execute(
            "DELETE FROM company_stats WHERE (benpos_date, isin) IN "
            "(SELECT DISTINCT CAST(benpos_date AS DATE), isin FROM holdings)"
        )
        con.execute(
            "INSERT INTO company_stats "
            "SELECT CAST(benpos_date AS DATE), isin, company_name, holder_count, "
            "clean_holder_count, total_qty, cdsl_holders, cdsl_qty, nsdl_holders, "
            "nsdl_qty, top10_qty, top10_pct, top50_qty, top50_pct, "
            "top100_qty, top100_pct "
            f"FROM ({STATS_QUERY})"
        )
        # Flat exports for file-less readers (the frontend never opens the
        # .duckdb file itself, so rebuilds can't collide with browsing).
        con.execute(
            f"COPY (SELECT * FROM company_stats) TO '{abs_root}/company_stats.csv' (HEADER)"
        )
        if ca_path:
            con.execute(
                f"COPY (SELECT * FROM ca_events) TO '{abs_root}/ca_events.csv' (HEADER)"
            )
            con.execute(
                f"COPY (SELECT * FROM ca_snapshot_factors) TO '{abs_root}/ca_snapshot_factors.csv' (HEADER)"
            )
    finally:
        con.close()
    return str(Path(out_root) / DB_NAME)


def _build_ca(con, root: Path, ca_path: str, company_map: str | None) -> None:
    """Parse CA file -> ca_events + ca_snapshot_factors + holdings_adj view."""
    from .ca import (load_security_code_map, parse_ca_csv, resolve_isin,
                     snapshot_factors)

    events = parse_ca_csv(ca_path)
    code_to_isin = load_security_code_map(company_map)
    names = con.execute(
        "SELECT DISTINCT UPPER(company_name) AS nm FROM holdings "
        "WHERE company_name IS NOT NULL"
    ).fetchdf()
    isins = con.execute(
        "SELECT DISTINCT company_name AS nm, isin FROM holdings "
        "WHERE company_name IS NOT NULL"
    ).fetchdf()
    name_to_isin = {str(n).upper(): str(i) for n, i in zip(isins["nm"], isins["isin"])}
    events = resolve_isin(events, code_to_isin, name_to_isin)

    con.execute(
        "CREATE TABLE IF NOT EXISTS ca_events ("
        "security_code VARCHAR, security_name VARCHAR, ca_company_name VARCHAR, "
        "ex_date DATE, purpose_raw VARCHAR, action VARCHAR, factor DOUBLE, "
        "status VARCHAR, isin VARCHAR, isin_via VARCHAR)"
    )
    con.execute("DELETE FROM ca_events")
    if len(events):
        ev = events.copy()
        ev["ex_date"] = ev["ex_date"].astype("string")
        con.register("ca_events_new", ev)
        con.execute("INSERT INTO ca_events SELECT * FROM ca_events_new")
        con.unregister("ca_events_new")

    snaps = con.execute(
        "SELECT DISTINCT isin, benpos_date FROM holdings"
    ).fetchdf()
    factors = snapshot_factors(events, snaps)
    con.execute(
        "CREATE TABLE IF NOT EXISTS ca_snapshot_factors ("
        "isin VARCHAR, benpos_date DATE, ca_factor DOUBLE, n_ca_applied BIGINT)"
    )
    con.execute("DELETE FROM ca_snapshot_factors")
    if len(factors):
        fac = factors.copy()
        con.register("ca_factors_new", fac)
        con.execute(
            "INSERT INTO ca_snapshot_factors "
            "SELECT isin, CAST(benpos_date AS DATE), ca_factor, n_ca_applied "
            "FROM ca_factors_new"
        )
        con.unregister("ca_factors_new")

    con.execute(
        "CREATE OR REPLACE VIEW holdings_adj AS "
        "SELECT h.*, COALESCE(f.ca_factor, 1.0) AS ca_factor, "
        "CAST(ROUND(h.total_qty * COALESCE(f.ca_factor, 1.0)) AS BIGINT) AS adjusted_qty "
        "FROM holdings h LEFT JOIN ca_snapshot_factors f "
        "ON f.isin = h.isin AND f.benpos_date = CAST(h.benpos_date AS DATE)"
    )

    open_issues = events[events["status"].isin(["needs_ratio", "unclassified"])]
    for r in open_issues.itertuples(index=False):
        print(f"CA WARNING [{r.status}]: {r.security_code} {r.security_name} "
              f"{r.ex_date} '{r.purpose_raw}' (isin={r.isin})")
    unresolved = events[events["isin"].isna()]
    for r in unresolved.itertuples(index=False):
        print(f"CA WARNING [unresolved]: code={r.security_code} "
              f"name='{r.security_name}/{r.ca_company_name}' not matched to any ISIN")
    n_parsed = int((events["status"] == "parsed").sum())
    print(f"ca_events: {len(events)} rows ({n_parsed} parsed), "
          f"factors for {len(factors)} company-snapshots")


def company_snapshot(out_root: str, isin: str, date: str | None = None,
                     top: int = 10) -> dict:
    """One company's stats row(s) + top holders, for the `stats` command."""
    con = connect(out_root)
    try:
        q = "SELECT * FROM company_stats WHERE isin = ?"
        params: list = [isin]
        if date:
            q += " AND benpos_date = ?"
            params.append(date)
        stats = con.execute(q, params).fetchdf()
        holders = con.execute(
            "SELECT investor_key, MAX(holder1) AS name, SUM(total_qty) AS qty, "
            "STRING_AGG(DISTINCT depository, '+') AS depo "
            "FROM holdings WHERE isin = ?"
            + (" AND benpos_date = ?" if date else "") +
            " GROUP BY investor_key ORDER BY qty DESC NULLS LAST LIMIT ?",
            params + [top],
        ).fetchdf()
    finally:
        con.close()
    return {"stats": stats, "top_holders": holders}
