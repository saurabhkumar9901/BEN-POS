"""CLI: single entrypoint, three subcommands.

  python -m benpos --input data --output processed        # process (default, backward compat)
  python -m benpos process --input data --output processed [--company-map m.csv --emit both --force]
  python -m benpos build-db --output processed           # (re)build benpos.duckdb + company_stats
  python -m benpos stats --output processed --isin INE... [--date 2026-07-17 --top 10]
"""
from __future__ import annotations

import argparse

from .db import build_db, company_snapshot
from .pipeline import process_all


def _add_process_args(p: argparse.ArgumentParser, required: bool = True) -> None:
    p.add_argument("--input", required=required, help="Input dir with BENPOS .txt files")
    p.add_argument("--output", required=required, help="Output root for partitioned Parquet")
    p.add_argument("--company-map", default=None, help="CSV with isin,company_name")
    p.add_argument("--chunksize", type=int, default=100_000)
    p.add_argument("--pattern", default="*.txt")
    p.add_argument("--emit", choices=["parquet", "csv", "both"], default="parquet")
    p.add_argument("--force", action="store_true",
                   help="reprocess even if file+checksum is already in the manifest")


def cmd_process(args: argparse.Namespace) -> None:
    manifest = process_all(
        args.input, args.output, company_map=args.company_map,
        chunksize=args.chunksize, pattern=args.pattern,
        emit=args.emit, force=args.force,
    )
    print(f"manifest rows: {len(manifest)}")
    if len(manifest):
        print(manifest[["source_file", "isin", "benpos_date", "depository", "rows"]].to_string(index=False))


def cmd_build_db(args: argparse.Namespace) -> None:
    path = build_db(args.output, ca_path=args.ca, company_map=args.company_map,
                    wait=args.wait)
    print(f"built {path}")


def cmd_stats(args: argparse.Namespace) -> None:
    snap = company_snapshot(args.output, args.isin, args.date, args.top)
    if len(snap["stats"]):
        print(snap["stats"].to_string(index=False))
    else:
        print(f"no stats for {args.isin} {args.date or ''}")
    print(f"\ntop {args.top} holders:")
    print(snap["top_holders"].to_string(index=False) if len(snap["top_holders"]) else "(none)")


def cmd_sync_md(args: argparse.Namespace) -> None:
    from .sync import sync_motherduck

    counts = sync_motherduck(args.output, database=args.database, token=args.token)
    for tbl, n in counts.items():
        print(f"{tbl}: {n}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="BENPOS preprocessing + query pipeline")
    sub = p.add_subparsers(dest="command")
    pp = sub.add_parser("process", help="parse .txt files into partitioned Parquet")
    _add_process_args(pp)
    pp.set_defaults(func=cmd_process)
    pb = sub.add_parser("build-db", help="build benpos.duckdb views + company_stats")
    pb.add_argument("--output", required=True, help="Processed root (holds Parquet + .duckdb)")
    pb.add_argument("--ca", default=None, help="BSE-style corporate-action CSV")
    pb.add_argument("--company-map", default=None,
                    help="CSV with isin,company_name[,security_code] for CA code->ISIN link")
    pb.add_argument("--wait", type=int, default=0,
                    help="seconds to keep retrying the writer lock (e.g. 120)")
    pb.set_defaults(func=cmd_build_db)
    ps = sub.add_parser("stats", help="print a company snapshot + top holders")
    ps.add_argument("--output", required=True)
    ps.add_argument("--isin", required=True)
    ps.add_argument("--date", default=None, help="benpos_date YYYY-MM-DD")
    ps.add_argument("--top", type=int, default=10)
    ps.set_defaults(func=cmd_stats)
    pm = sub.add_parser("sync-md", help="copy processed relations to MotherDuck")
    pm.add_argument("--output", required=True, help="Processed root (holds Parquet + .duckdb)")
    pm.add_argument("--database", default="benpos", help="MotherDuck database name")
    pm.add_argument("--token", default=None, help="MotherDuck token (else MOTHERDUCK_TOKEN env)")
    pm.set_defaults(func=cmd_sync_md)
    # backward compat: bare `python -m benpos --input ...` == process
    _add_process_args(p, required=False)
    return p


def main(argv=None) -> None:
    args = build_parser().parse_args(argv)
    if getattr(args, "func", None) is not None:
        args.func(args)
    else:
        if not args.input or not args.output:
            build_parser().error("--input and --output are required for process")
        cmd_process(args)  # no subcommand -> process


if __name__ == "__main__":
    main()
