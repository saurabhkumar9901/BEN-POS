"""Orchestration: file -> normalized chunk -> partitioned Parquet + manifest.

Output layout (Hive-style, append-only):
  processed/benpos_date=YYYY-MM-DD/isin=INE.../depository={nsdl,cdsl}.parquet
Plus a faithful full-width dump alongside:
  processed/.../depository_full.parquet  (all 84/104 source columns + trace)
And the curated cross-depository view:
  processed/.../depository_unified.parquet (UNIFIED_COLUMNS)

Manifest processed/_manifest.csv makes weekly re-runs idempotent.
"""
from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from . import normalize as N
from . import privacy, validate
from .detect import detect_file
from .keys import investor_key, key_with_type, normalize_name
from .parsers import parse_cdsl_chunks, parse_nsdl_chunks
from .schema import TRACE_COLUMNS, UNIFIED_COLUMNS

MANIFEST_COLUMNS = [
    "source_file", "checksum_md5", "isin", "benpos_date",
    "depository", "rows", "output_path", "processed_at",
]


def write_table(df: pd.DataFrame, path: str) -> None:
    """Write one output table. Format follows the suffix: .parquet or .csv."""
    if str(path).endswith(".csv"):
        df.to_csv(path, index=False)
    else:
        df.to_parquet(path, index=False)


def md5_of(path: str, block: int = 1 << 20) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        while True:
            b = f.read(block)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def _benpos_date(raw) -> str | None:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    s = str(raw).strip()
    if not s:
        return None
    d = N.to_date_iso(pd.Series([s])).iloc[0]
    if d is None or pd.isna(d):
        return None
    return d.isoformat()


def _normalize_chunk(df: pd.DataFrame, depository: str) -> pd.DataFrame:
    df = df.copy()
    for c in ("pan1", "pan2", "pan3"):
        if c in df:
            df[c] = N.norm_pan(df[c])
    for c in ("email", "email1", "email2"):
        if c in df:
            df[c] = N.norm_email(df[c])
    for c in ("holder1", "holder2", "holder3", "bank_name", "father_guardian"):
        if c in df:
            df[c] = N.norm_text(df[c])
    if "total_qty" in df:
        df["total_qty"] = N.to_qty(df["total_qty"])
    if "free_qty" in df:
        df["free_qty"] = N.to_qty(df["free_qty"])
    if "benpos_date_raw" in df:
        df["benpos_date"] = N.to_date_iso(df["benpos_date_raw"].astype("string"))
    for c in ("dob", "bo_open_date"):
        if c in df:
            df[c] = pd.to_datetime(
                df[c].astype("string").str.strip(), format="%d-%b-%Y", errors="coerce"
            ).dt.date
    df["name_norm"] = normalize_name(df["holder1"] if "holder1" in df else pd.Series([""] * len(df)))
    kt = key_with_type(df, depository)
    df["investor_key"] = kt["investor_key"]
    df["key_type"] = kt["key_type"]
    df["identity_confidence"] = kt["key_type"].map(
        {"pan": "high", "acct": "medium", "name": "low"}
    ).astype("string")
    return df


def _unified(df: pd.DataFrame, *, isin, company, depository, benpos_date, source_file) -> pd.DataFrame:
    n = len(df)
    if depository == "cdsl":
        account = df["boid"] if "boid" in df else pd.Series([pd.NA] * n)
        addr = pd.Series([""] * n, index=df.index, dtype="string")
        for c in ("perm_addr1", "perm_addr2", "perm_addr3", "perm_addr4", "perm_state", "perm_country"):
            if c in df:
                addr = (addr.fillna("") + " " + df[c].astype("string").fillna("")).str.strip()
        pin = df["perm_pin"] if "perm_pin" in df else pd.Series([pd.NA] * n)
        mobile = df["mobile"] if "mobile" in df else pd.Series([pd.NA] * n)
        email = df["email"] if "email" in df else pd.Series([pd.NA] * n)
        free = df["free_qty"] if "free_qty" in df else pd.Series([pd.NA] * n)
        htype = df["holder_type"] if "holder_type" in df else pd.Series([pd.NA] * n)
        state = df["perm_state"] if "perm_state" in df else pd.Series([pd.NA] * n)
    else:
        account = (df["dp_id"].astype("string") + df["client_id"].astype("string"))
        addr = pd.Series([""] * n, index=df.index, dtype="string")
        for c in ("addr1", "addr2", "addr3", "addr_city"):
            if c in df:
                addr = (addr.fillna("") + " " + df[c].astype("string").fillna("")).str.strip()
        pin = df["addr_pin"] if "addr_pin" in df else pd.Series([pd.NA] * n)
        mobile = df["phone"] if "phone" in df else pd.Series([pd.NA] * n)
        email = df["email1"] if "email1" in df else pd.Series([pd.NA] * n)
        free = pd.Series([pd.NA] * n, dtype="Int64")
        htype = df["holding_type"] if "holding_type" in df else pd.Series([pd.NA] * n)
        state = df["state_code"] if "state_code" in df else pd.Series([pd.NA] * n)

    u = pd.DataFrame({
        "isin": isin,
        "company_name": company,
        "depository": depository,
        "benpos_date": benpos_date,
        "account_id": account,
        "holder1": df.get("holder1"),
        "holder2": df.get("holder2"),
        "holder3": df.get("holder3"),
        "name_norm": df.get("name_norm"),
        "pan1": df.get("pan1"),
        "pan2": df.get("pan2"),
        "pan3": df.get("pan3"),
        "investor_key": df.get("investor_key"),
        "key_type": df.get("key_type"),
        "identity_confidence": df.get("identity_confidence"),
        "address_full": addr.str.replace(r"\s+", " ", regex=True).str.strip().mask(
            addr.str.strip() == "", pd.NA
        ),
        "pin": pin,
        "mobile": mobile,
        "email": email,
        "bank_name": df.get("bank_name"),
        "bank_acct": df.get("bank_acct"),
        "ifsc": df.get("ifsc"),
        "micr": df.get("micr"),
        "total_qty": df.get("total_qty"),
        "free_qty": free,
        "holding_type": htype,
        "state_code": state,
        "validation_flags": df.get("validation_flags"),
        "source_file": os.path.basename(source_file),
        "source_row": df.get("source_row"),
    })
    return u[UNIFIED_COLUMNS]


def process_file(
    path: str, out_root: str, *, company_map: dict | None = None,
    chunksize: int = 100_000, depository: str | None = None,
    emit: str = "parquet",
) -> dict:
    """Parse one BENPOS file. emit: 'parquet' | 'csv' | 'both'."""
    if emit not in ("parquet", "csv", "both"):
        raise ValueError("emit must be parquet, csv or both")
    dep = depository or detect_file(path)
    parser = parse_nsdl_chunks if dep == "nsdl" else parse_cdsl_chunks
    chunks_full = []
    meta_last: dict = {}
    rows = 0
    for raw, meta in parser(path, chunksize):
        meta_last = meta
        df = _normalize_chunk(raw, dep)
        df["depository"] = dep
        df["source_file"] = os.path.basename(path)
        isin = meta.get("isin")
        bdate = _benpos_date(
            meta.get("benpos_date_raw")
            or (df["benpos_date_raw"].iloc[0] if "benpos_date_raw" in df and len(df) else None)
        )
        df["benpos_date"] = bdate
        df["isin"] = isin
        rows += len(df)
        chunks_full.append(df)
    full = pd.concat(chunks_full, ignore_index=True) if chunks_full else pd.DataFrame()
    # File-scope validation (duplicates + row flags need the whole file, still vectorised)
    full = validate.flag_rows(full, dep)
    full = validate.mark_duplicates(full, dep)
    full["validation_flags"] = validate.combine_flags(full)
    full = full.drop(columns=[c for c in full.columns if c.startswith("_vf_")])
    unified = _unified(
        full, isin=meta_last.get("isin"),
        company=(company_map or {}).get(meta_last.get("isin") or ""),
        depository=dep,
        benpos_date=_benpos_date(meta_last.get("benpos_date_raw")),
        source_file=path,
    ) if len(full) else pd.DataFrame()
    isin = meta_last.get("isin") or "UNKNOWN"
    bdate = _benpos_date(meta_last.get("benpos_date_raw")) or "unknown-date"
    dest = Path(out_root) / f"benpos_date={bdate}" / f"isin={isin}"
    dest.mkdir(parents=True, exist_ok=True)
    full_path = dest / f"depository={dep}_full.parquet"
    uni_path = dest / f"depository={dep}_unified.parquet"
    safe = privacy.make_safe(unified) if len(unified) else unified
    safe_path = dest / f"depository={dep}_unified_safe.parquet"
    outputs: list[str] = []
    if emit in ("parquet", "both"):
        write_table(full, str(full_path))
        write_table(unified, str(uni_path))
        write_table(safe, str(safe_path))
        outputs += [str(full_path), str(uni_path), str(safe_path)]
    if emit in ("csv", "both"):
        full_csv = dest / f"depository={dep}_full.csv"
        uni_csv = dest / f"depository={dep}_unified.csv"
        safe_csv = dest / f"depository={dep}_unified_safe.csv"
        write_table(full, str(full_csv))
        write_table(unified, str(uni_csv))
        write_table(safe, str(safe_csv))
        outputs += [str(full_csv), str(uni_csv), str(safe_csv)]
    primary = str(uni_path) if emit in ("parquet", "both") else str(uni_csv)
    manifest_rec = {
        "source_file": os.path.basename(path),
        "checksum_md5": md5_of(path),
        "isin": isin,
        "benpos_date": bdate,
        "depository": dep,
        "rows": rows,
        "output_path": primary,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    report_rec = validate.file_report(
        os.path.basename(path), isin, bdate, dep, unified, meta_last
    )
    return manifest_rec, report_rec


def load_company_map(path: str | None) -> dict:
    if not path:
        return {}
    m = pd.read_csv(path, dtype=str)
    cols = {c.lower(): c for c in m.columns}
    ic, nc = cols.get("isin"), cols.get("company_name")
    if not ic:
        raise ValueError("company-map CSV needs isin[,company_name] columns")
    if nc:
        return dict(zip(m[ic].str.strip(), m[nc].str.strip()))
    return {k.strip(): None for k in m[ic]}


def process_all(
    input_dir: str, out_root: str, *, company_map: str | None = None,
    chunksize: int = 100_000, pattern: str = "*.txt",
    emit: str = "parquet", force: bool = False,
) -> pd.DataFrame:
    cmap = load_company_map(company_map)
    manifest_path = Path(out_root) / "_manifest.csv"
    if manifest_path.exists():
        manifest = pd.read_csv(manifest_path, dtype=str)
    else:
        manifest = pd.DataFrame(columns=MANIFEST_COLUMNS)
    done = set(manifest["source_file"].tolist()) if len(manifest) else set()

    records, reports = [], []
    files = sorted(Path(input_dir).rglob(pattern))
    if not files:
        raise FileNotFoundError(f"No {pattern} files under {input_dir}")
    for fp in files:
        checksum = md5_of(str(fp))
        already = (
            (manifest["source_file"] == fp.name) & (manifest["checksum_md5"] == checksum)
        ) if len(manifest) else pd.Series([], dtype=bool)
        if bool(already.any()) and not force:
            continue  # idempotent: same file+checksum already processed
        if bool(already.any()):
            manifest = manifest.drop(manifest[already].index)  # re-record on --force
        rec, rep = process_file(
            str(fp), out_root, company_map=cmap, chunksize=chunksize, emit=emit
        )
        records.append(rec)
        reports.append(rep)
    if records:
        manifest = pd.concat([manifest, pd.DataFrame(records)], ignore_index=True)
        Path(out_root).mkdir(parents=True, exist_ok=True)
        manifest.to_csv(manifest_path, index=False)
    if reports:
        vrep = pd.DataFrame(reports)
        vrep.to_csv(Path(out_root) / "validation_report.csv", index=False)
    return manifest
