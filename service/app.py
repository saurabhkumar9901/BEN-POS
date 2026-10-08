"""BENPOS ingest worker: downloads BENPOS drops from R2, runs the pipeline,
syncs results to MotherDuck. Designed for Render free tier (512MB RAM):
chunked parsing, no persistent disk (state lives in MotherDuck/R2).

  POST /ingest  {keys: [...], ca_key?: str} -> {jobId}
  GET  /jobs/{id}                           -> {state, counts?, error?}
  GET  /health                               -> {ok: true}
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
import traceback
import uuid
from pathlib import Path

import boto3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

WORK_ROOT = Path(os.environ.get("WORK_ROOT", "/tmp/benpos"))
COMPANY_MAP = Path(__file__).resolve().parent / "company_map.csv"

app = FastAPI(title="benpos-ingest")
jobs: dict[str, dict] = {}


class IngestRequest(BaseModel):
    keys: list[str] = Field(min_length=1, description="R2 object keys of BENPOS .txt drops")
    ca_key: str | None = Field(default=None, description="R2 object key of CA .csv")


def r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )


def download_key(client, bucket: str, key: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    client.download_file(bucket, key, str(dest))


def run_ingest(job_id: str, keys: list[str], ca_key: str | None) -> None:
    from benpos.pipeline import process_all
    from benpos.db import build_db
    from benpos.sync import sync_motherduck

    job = jobs[job_id]
    root = WORK_ROOT / job_id
    data, out = root / "data", root / "processed"
    try:
        client = r2_client()
        bucket = os.environ["R2_BUCKET"]
        job["phase"] = "download"
        for k in keys:
            download_key(client, bucket, k, data / Path(k).name)
        ca_path = None
        if ca_key:
            ca_path = root / "ca.csv"
            download_key(client, bucket, ca_key, ca_path)

        job["phase"] = "process"
        manifest = process_all(str(data), str(out),
                               company_map=str(COMPANY_MAP), emit="parquet")
        job["phase"] = "build-db"
        build_db(str(out), ca_path=str(ca_path) if ca_path else None,
                 company_map=str(COMPANY_MAP))
        job["phase"] = "sync"
        counts = sync_motherduck(str(out),
                                 database=os.environ.get("MD_DATABASE", "benpos"))
        job.update(state="done", counts=counts, finished=time.time())
    except Exception as err:  # noqa: BLE001 - surfaced in job status
        job.update(state="failed", error=f"{err}\n{traceback.format_exc(limit=5)}")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/ingest")
async def ingest(req: IngestRequest) -> dict:
    for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
                 "R2_BUCKET", "MOTHERDUCK_TOKEN"):
        if not os.environ.get(name):
            raise HTTPException(500, f"server misconfigured: {name} missing")
    job_id = uuid.uuid4().hex[:8]
    jobs[job_id] = {"jobId": job_id, "state": "running", "phase": "queued",
                    "started": time.time(), "files": req.keys}
    asyncio.create_task(asyncio.to_thread(run_ingest, job_id, req.keys, req.ca_key))
    return {"jobId": job_id}


@app.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "unknown job")
    return job
