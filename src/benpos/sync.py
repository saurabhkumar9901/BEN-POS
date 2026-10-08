"""Sync processed output to MotherDuck (hosted DuckDB).

Materializes every relation the frontend reads as `md.main` tables/views,
so the UI needs zero query changes: same names, same columns.

  python -m benpos sync-md --output processed --database benpos

Requires MOTHERDUCK_TOKEN env (or --token). Runs anywhere Python runs:
laptop bootstrap, Render ingest service, CI.
"""
from __future__ import annotations

import os
from pathlib import Path

DB_FILE = "benpos.duckdb"

# Local source (view/table in benpos.duckdb) -> remote md.main name.
MD_TABLES = [
    "holdings",
    "holdings_display",
    "position_detail",
    "company_stats",
    "file_validation",
    "manifest",
    "ca_events",
    "ca_snapshot_factors",
]

MD_VIEWS = {
    "xdp_holders": (
        "SELECT benpos_date, isin, MAX(company_name) AS company_name, "
        "investor_key, MAX(holder1) AS name, SUM(total_qty) AS total_qty, "
        "COUNT(*) AS rows, STRING_AGG(DISTINCT depository, '+') AS depo "
        "FROM holdings GROUP BY benpos_date, isin, investor_key "
        "HAVING COUNT(DISTINCT depository) = 2"
    ),
    "multi_accounts": (
        "SELECT benpos_date, isin, depository, investor_key, "
        "MAX(holder1) AS name, COUNT(DISTINCT account_id) AS n_accounts, "
        "SUM(total_qty) AS total_qty "
        "FROM holdings GROUP BY benpos_date, isin, depository, investor_key "
        "HAVING COUNT(DISTINCT account_id) > 1"
    ),
    "identity_review": (
        "SELECT benpos_date, isin, depository, investor_key, holder1, "
        "name_norm, pan1, pin, total_qty, account_id, "
        "source_file, source_row "
        "FROM holdings WHERE identity_confidence = 'low'"
    ),
}


def _exists(con, name: str) -> bool:
    try:
        con.execute(f"SELECT 1 FROM {name} LIMIT 0")
        return True
    except Exception:
        return False


def sync_motherduck(out_root: str, database: str = "benpos",
                    token: str | None = None) -> dict:
    """Copy local relations into the MotherDuck database. Returns row counts."""
    import duckdb

    token = token or os.environ.get("MOTHERDUCK_TOKEN")
    if not token:
        raise ValueError("MOTHERDUCK_TOKEN env (or --token) is required")
    root = Path(out_root)
    con = duckdb.connect(str(root / DB_FILE))
    counts: dict = {}
    try:
        con.execute("INSTALL motherduck")
        con.execute("LOAD motherduck")
        con.execute(f"SET motherduck_token='{token}'")
        con.execute(f"ATTACH 'md:{database}' AS md")
        for tbl in MD_TABLES:
            if not _exists(con, tbl):
                counts[tbl] = "skipped (absent locally)"
                continue
            con.execute(f"CREATE OR REPLACE TABLE md.main.{tbl} AS SELECT * FROM {tbl}")
            counts[tbl] = con.execute(f"SELECT COUNT(*) FROM md.main.{tbl}").fetchone()[0]
        for name, sql in MD_VIEWS.items():
            con.execute(f"CREATE OR REPLACE VIEW md.main.{name} AS {sql}")
        counts["_views"] = sorted(MD_VIEWS)
        return counts
    finally:
        con.close()
