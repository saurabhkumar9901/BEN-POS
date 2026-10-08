"""Row-level validation flags + file-level trailer checks (BRD Sec 12).

No hard fails: every row is kept, flags are semicolon-separated in
`validation_flags` ('' = clean) so downstream consumers filter `flag = clean`.
File-level trailer checks (COUNT / QTY vs NSDL 01 record) live in the
per-file validation_report.csv, not on rows.

Flag semantics describe the DATA only (never investor behaviour),
per the No Unsupported Causality principle.
"""
from __future__ import annotations

import re

import pandas as pd

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PIN_RE = re.compile(r"^\d{6}$")

NSDL_WIDTH = 84
CDSL_WIDTH = 104

ROW_FLAGS = [
    "BAD_WIDTH", "DUP_ACCOUNT", "BAD_PAN", "BAD_EMAIL",
    "BAD_MOBILE", "BAD_PIN", "ZERO_QTY", "PLEDGED_ONLY",
]


def _digits(s: pd.Series) -> pd.Series:
    return s.astype("string").fillna("").str.replace(r"\D", "", regex=True)


def flag_rows(df: pd.DataFrame, depository: str) -> pd.DataFrame:
    """Add boolean _vf_<FLAG> columns. Caller combines into validation_flags."""
    df = df.copy()
    width = NSDL_WIDTH if depository == "nsdl" else CDSL_WIDTH
    raw_w = pd.to_numeric(df.get("_raw_width"), errors="coerce")
    df["_vf_BAD_WIDTH"] = raw_w.notna() & (raw_w != width)

    pan = df["pan1"].astype("string").fillna("") if "pan1" in df else ""
    df["_vf_BAD_PAN"] = pan.ne("") & ~pan.str.match(PAN_RE)

    mail_col = "email" if depository == "cdsl" else "email1"
    mail = df[mail_col].astype("string").fillna("") if mail_col in df else ""
    df["_vf_BAD_EMAIL"] = mail.ne("") & ~mail.str.match(EMAIL_RE)

    mob_col = "mobile" if depository == "cdsl" else "phone"
    mob = _digits(df[mob_col]) if mob_col in df else pd.Series([""] * len(df))
    df["_vf_BAD_MOBILE"] = mob.ne("") & (mob.str.len() < 10)

    pin_col = "perm_pin" if depository == "cdsl" else "addr_pin"
    pin = df[pin_col].astype("string").fillna("").str.strip() if pin_col in df else ""
    df["_vf_BAD_PIN"] = pin.ne("") & ~pin.str.match(PIN_RE)

    qty = pd.to_numeric(df.get("total_qty"), errors="coerce")
    df["_vf_ZERO_QTY"] = qty.fillna(-1).eq(0)

    if depository == "cdsl" and "free_qty" in df:
        free = pd.to_numeric(df["free_qty"], errors="coerce")
        df["_vf_PLEDGED_ONLY"] = qty.fillna(0).gt(0) & free.fillna(-1).eq(0)
    else:
        df["_vf_PLEDGED_ONLY"] = False
    return df


def mark_duplicates(df: pd.DataFrame, depository: str) -> pd.DataFrame:
    """Flag repeated accounts within one file; account-level traceability kept."""
    df = df.copy()
    if depository == "cdsl" and "boid" in df:
        key = df["boid"].astype("string").fillna("")
    elif "dp_id" in df and "client_id" in df:
        key = df["dp_id"].astype("string").fillna("") + "|" + df["client_id"].astype("string").fillna("")
    else:
        df["_vf_DUP_ACCOUNT"] = False
        return df
    dup = key.duplicated(keep=False) & key.ne("|").ne("")
    df["_vf_DUP_ACCOUNT"] = dup
    return df


def combine_flags(df: pd.DataFrame) -> pd.Series:
    cols = [f"_vf_{f}" for f in ROW_FLAGS if f"_vf_{f}" in df]
    if not cols:
        return pd.Series([""] * len(df), index=df.index)
    mat = df[cols].fillna(False).astype(bool)
    return mat.apply(lambda r: ";".join([c[4:] for c, v in r.items() if v]), axis=1)


def file_report(source_file: str, isin, benpos_date, depository: str,
                df: pd.DataFrame, meta: dict) -> dict:
    """One rollup row per source file for validation_report.csv."""
    rec: dict = {
        "source_file": source_file, "isin": isin, "benpos_date": benpos_date,
        "depository": depository, "rows": len(df),
    }
    flags = df["validation_flags"].fillna("") if "validation_flags" in df else pd.Series([])
    flagged = flags.ne("")
    rec["clean_rows"] = int((~flagged).sum())
    rec["flagged_rows"] = int(flagged.sum())
    for f in ROW_FLAGS:
        rec[f"n_{f}"] = int(flags.str.contains(f, regex=False).sum())
    # NSDL 01 trailer reconciliation (H7 = detail qty bucket, H23 = count)
    rec["trailer_count"] = meta.get("record_count")
    rec["trailer_qty"] = meta.get("trailer_qty")
    qty_sum = pd.to_numeric(df["total_qty"], errors="coerce").sum() if "total_qty" in df else None
    rec["parsed_qty"] = int(qty_sum) if qty_sum is not None and pd.notna(qty_sum) else None
    tc = meta.get("record_count")
    rec["count_match"] = (len(df) == tc) if tc is not None else None
    tq = meta.get("trailer_qty")
    rec["qty_match"] = (rec["parsed_qty"] == tq) if tq is not None and rec["parsed_qty"] is not None else None
    return rec
