"""Sync processed output to MotherDuck (hosted DuckDB).

Materializes every relation the frontend reads as `md.main` tables/views,
so the UI needs zero query changes: same names, same columns.

  python -m benpos sync-md --output processed --database benpos
  python -m benpos sync-md --output processed --verbose --log-file

Requires MOTHERDUCK_TOKEN env (or --token). Runs anywhere Python runs:
laptop bootstrap, Render ingest service, CI.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
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


def _logger(out_root: str, verbose: bool, log_file: str | None) -> logging.Logger:
    """Console + optional file logger. Bare --log-file writes processed/sync_<utc>.log."""
    if log_file not in (None, "", "-"):
        log_path: Path | None = Path(log_file)
    elif log_file == "":
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        log_path = Path(out_root) / f"sync_{stamp}.log"
    else:
        log_path = None
    logger = logging.getLogger("benpos.sync")
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.handlers.clear()
    fmt = logging.Formatter("%(asctime)s %(levelname)-5s %(message)s", datefmt="%H:%M:%S")
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    logger.addHandler(console)
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)
        logger.info("logging to %s", log_path)
    return logger


def sync_motherduck(out_root: str, database: str = "benpos",
                    token: str | None = None, verbose: bool = False,
                    log_file: str | None = None) -> dict:
    """Copy local relations into the MotherDuck database. Returns row counts."""
    import duckdb

    log = _logger(out_root, verbose, log_file)
    token = token or os.environ.get("MOTHERDUCK_TOKEN")
    if not token:
        raise ValueError("MOTHERDUCK_TOKEN env (or --token) is required")
    root = Path(out_root)
    t_all = time.perf_counter()
    total_rows = 0
    con = duckdb.connect(str(root / DB_FILE))
    counts: dict = {}
    try:
        log.info("attaching md:%s", database)
        con.execute("INSTALL motherduck")
        con.execute("LOAD motherduck")
        con.execute(f"SET motherduck_token='{token}'")
        con.execute(f"ATTACH 'md:{database}' AS md")
        for tbl in MD_TABLES:
            if not _exists(con, tbl):
                counts[tbl] = "skipped (absent locally)"
                log.warning("skipping %s (absent locally)", tbl)
                continue
            log.info("syncing %s ...", tbl)
            t0 = time.perf_counter()
            try:
                con.execute(f"CREATE OR REPLACE TABLE md.main.{tbl} AS SELECT * FROM {tbl}")
                n = con.execute(f"SELECT COUNT(*) FROM md.main.{tbl}").fetchone()[0]
            except Exception as err:  # noqa: BLE001 - one-line failure, then raise
                log.error("FAILED %s: %s", tbl, err)
                raise
            dt = time.perf_counter() - t0
            rate = f"{n / dt:,.0f} rows/s" if dt > 0 else "n/a"
            log.info("%s: %s rows in %.1fs (%s)", tbl, f"{n:,}", dt, rate)
            counts[tbl] = n
            total_rows += n if isinstance(n, int) else 0
        for name, sql in MD_VIEWS.items():
            con.execute(f"CREATE OR REPLACE VIEW md.main.{name} AS {sql}")
        counts["_views"] = sorted(MD_VIEWS)
        log.debug("recreated views: %s", ", ".join(sorted(MD_VIEWS)))
        log.info("done: %s rows in %.1fs", f"{total_rows:,}", time.perf_counter() - t_all)
        return counts
    finally:
        con.close()
