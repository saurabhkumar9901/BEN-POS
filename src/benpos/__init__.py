"""BENPOS preprocessing + query pipeline: NSDL (##) + CDSL (~) -> Parquet/CSV + DuckDB."""
from .db import build_db, company_snapshot
from .sync import sync_motherduck
from .ca import parse_ca_csv, resolve_isin, snapshot_factors
from .pipeline import process_all, process_file, write_table
from .privacy import make_safe, mask_name
from .validate import file_report, flag_rows

__all__ = [
    "process_all", "process_file", "write_table",
    "build_db", "company_snapshot", "sync_motherduck", "flag_rows", "file_report",
    "make_safe", "mask_name",
    "parse_ca_csv", "resolve_isin", "snapshot_factors",
]
__version__ = "0.7.0"
