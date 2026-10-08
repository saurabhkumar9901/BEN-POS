"""Minimal type coercion: no rejection, empty -> NULL, raw kept on failure path.

- qty: '500.000' / '10000' / '' -> nullable Int64
- dates: YYYYMMDD, DDMMYYYY, DD-MMM-YYYY -> ISO date
- PAN: upper+strip, empty -> None
- email: lower+strip; name/address/bank: collapsed whitespace
"""
from __future__ import annotations

import re
from datetime import date

import numpy as np
import pandas as pd

_WS = re.compile(r"\s+")


def to_qty(s: pd.Series) -> pd.Series:
    num = pd.to_numeric(
        s.astype("string").str.strip().str.replace(",", "", regex=False), errors="coerce"
    )
    return num.round(0).astype("Int64")


def to_date_iso(s: pd.Series) -> pd.Series:
    out = pd.to_datetime(s.astype("string").str.strip(), format="%Y%m%d", errors="coerce")
    mask = out.isna()
    if mask.any():
        out2 = pd.to_datetime(
            s[mask].astype("string").str.strip(), format="%d%m%Y", errors="coerce"
        )
        out = out.mask(mask, out2)
    mask = out.isna()
    if mask.any():
        out3 = pd.to_datetime(s[mask].astype("string").str.strip(), format="%d-%b-%Y", errors="coerce")
        out = out.mask(mask, out3)
    return out.dt.date


_PAN_NULLS = {"", "NA", "N.A.", "N/A", "NAN", "NONE", "NULL", "NIL", "-", "--"}


def norm_pan(s: pd.Series) -> pd.Series:
    v = s.astype("string").str.strip().str.upper().str.replace(r"\s+", "", regex=True)
    v = v.str.replace(".", "", regex=False)
    return v.mask(v.isin({t.replace(".", "") for t in _PAN_NULLS}), pd.NA)


def norm_email(s: pd.Series) -> pd.Series:
    v = s.astype("string").str.strip().str.lower()
    return v.mask(v == "", pd.NA)


def norm_text(s: pd.Series) -> pd.Series:
    v = s.astype("string").str.strip()
    v = v.str.replace(_WS, " ", regex=True)
    return v.mask(v == "", pd.NA)


def empty_to_null(df: pd.DataFrame) -> pd.DataFrame:
    return df.replace(r"^\s*$", np.nan, regex=True)
