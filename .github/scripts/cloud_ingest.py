"""Cloud ingest driver: Supabase staging -> pipeline -> MotherDuck.

Runs on GitHub Actions (or anywhere with Python + env). Staging is
transient: keys are deleted from the bucket after a successful sync,
because free-tier storage caps (1 GB) fit one weekly drop, not history.

Env:
  BENPOS_KEYS   newline-separated Supabase object keys of BENPOS .txt drops
  CA_KEY        Supabase object key of the CA .csv (optional)
  S3_ENDPOINT_URL / S3_KEY_ID / S3_SECRET / S3_REGION / S3_BUCKET
  COMPANY_MAP   path to company_map.csv (default: company_map.csv)
  MOTHERDUCK_TOKEN / MD_DATABASE (default: benpos)
  WORK_ROOT     scratch dir (default: work)
"""
from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("cloud-ingest")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "src"))


def s3_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT_URL"],
        aws_access_key_id=os.environ["S3_KEY_ID"],
        aws_secret_access_key=os.environ["S3_SECRET"],
        region_name=os.environ.get("S3_REGION", "us-east-1"),
    )


def main() -> int:
    from benpos.db import build_db
    from benpos.pipeline import process_all
    from benpos.sync import sync_motherduck

    bucket = os.environ["S3_BUCKET"]
    keys = [k.strip() for k in os.environ.get("BENPOS_KEYS", "").splitlines() if k.strip()]
    ca_key = os.environ.get("CA_KEY", "").strip() or None
    if not keys:
        log.error("BENPOS_KEYS is empty")
        return 2
    work = Path(os.environ.get("WORK_ROOT", "work"))
    data, out = work / "data", work / "processed"
    data.mkdir(parents=True, exist_ok=True)

    client = s3_client()
    t0 = time.perf_counter()
    for k in keys:
        dest = data / Path(k).name
        log.info("downloading s3://%s/%s -> %s", bucket, k, dest)
        client.download_file(bucket, k, str(dest))
    ca_path = None
    if ca_key:
        ca_path = work / "ca.csv"
        log.info("downloading s3://%s/%s -> %s", bucket, ca_key, ca_path)
        client.download_file(bucket, ca_key, str(ca_path))

    cmap = os.environ.get("COMPANY_MAP", "company_map.csv")
    log.info("processing %d files", len(keys))
    manifest = process_all(str(data), str(out), company_map=cmap, emit="parquet")
    log.info("parsed %d rows", int(manifest["rows"].astype(int).sum()) if len(manifest) else 0)

    log.info("building db")
    build_db(str(out), ca_path=str(ca_path) if ca_path else None, company_map=cmap)

    md_db = os.environ.get("MD_DATABASE", "benpos")
    log.info("syncing to MotherDuck db=%s", md_db)
    counts = sync_motherduck(str(out), database=md_db)
    log.info("synced: %s", {k: v for k, v in counts.items() if not str(v).startswith("skipped")})

    # Staging discipline: free-tier buckets fit one drop, not history.
    doomed = keys + ([ca_key] if ca_key else [])
    log.info("deleting %d staged keys", len(doomed))
    client.delete_objects(Bucket=bucket, Delete={"Objects": [{"Key": k} for k in doomed]})
    log.info("done in %.1fs", time.perf_counter() - t0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
