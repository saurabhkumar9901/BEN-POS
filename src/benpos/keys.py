"""Investor identity key + normalized name for future resolution (BRD Sec 2/12).

Fallback chain (first available wins, hashed):
  1. PAN1 normalized (upper, no spaces)
  2. CDSL: BOID / NSDL: DPID+CLIENTID
  3. name_norm + dob/pin when neither exists

investor_key = 'ik_' + sha256(tag + ':' + value).hexdigest()[:16]
The tag prefix keeps PAN-derived and account-derived keys in separate namespaces
so a PAN match never collides with an account match. name_norm is also emitted
for blocking in future identity-resolution passes.
"""
from __future__ import annotations

import hashlib
import re

import pandas as pd

_WS = re.compile(r"\s+")
_PUNC = re.compile(r"[.\-_,/()]+$|^[.\-_,/()]+")

KEY_PREFIX = "ik_"


def normalize_name(s: pd.Series) -> pd.Series:
    v = s.astype("string").fillna("").str.upper().str.strip()
    v = v.str.replace(r"[.\-_,/()]", " ", regex=True)
    v = v.str.replace(_WS, " ", regex=True).str.strip()
    return v.mask(v == "", pd.NA)


def _hash(tag: str, value: str) -> str:
    return KEY_PREFIX + hashlib.sha256(f"{tag}:{value}".encode("utf-8")).hexdigest()[:16]


def key_with_type(df: pd.DataFrame, depository: str) -> pd.DataFrame:
    """investor_key + key_type ('pan' | 'acct' | 'name') per row.

    Fallback chain, first available wins:
      pan  - normalized PAN1 present
      acct - CDSL BOID / NSDL DPID+CLIENTID (PAN absent)
      name - name_norm + dob/pin (neither available)
    """
    n = len(df)
    keys: list[str | None] = [None] * n
    types: list[str | None] = [None] * n

    pan = df["pan1"] if "pan1" in df else pd.Series([pd.NA] * n)
    pan = pan.astype("string").str.strip().str.upper().str.replace(r"\s+", "", regex=True)

    if depository == "cdsl" and "boid" in df:
        acct = df["boid"].astype("string").str.strip()
    elif "dp_id" in df and "client_id" in df:
        acct = (
            df["dp_id"].astype("string").str.strip()
            + df["client_id"].astype("string").str.strip()
        )
    else:
        acct = pd.Series([pd.NA] * n, index=df.index if len(df) else None)

    name = df["name_norm"] if "name_norm" in df else normalize_name(
        df["holder1"] if "holder1" in df else pd.Series([""] * n)
    )
    dob_pin = pd.Series([""] * n)
    if "dob" in df:
        dob_pin = dob_pin + df["dob"].astype("string").fillna("")
    for c in ("addr_pin", "perm_pin", "corr_pin", "pin"):
        if c in df:
            dob_pin = dob_pin + df[c].astype("string").fillna("")
            break

    pan_l = pan.tolist()
    acct_l = acct.tolist() if len(acct) == n else [None] * n
    name_l = name.astype("string").tolist()
    extra_l = dob_pin.tolist()

    for i in range(n):
        p = pan_l[i]
        if isinstance(p, str) and p and p not in ("", "NA", "NAN", "NONE", "NULL"):
            keys[i] = _hash("pan", p)
            types[i] = "pan"
            continue
        a = acct_l[i]
        if isinstance(a, str) and a.strip() not in ("", "<NA>", "nan", "None"):
            keys[i] = _hash("acct", a.strip())
            types[i] = "acct"
            continue
        nm = name_l[i]
        if isinstance(nm, str) and nm:
            keys[i] = _hash("name", f"{nm}|{extra_l[i]}")
            types[i] = "name"
    out = pd.DataFrame({"investor_key": keys, "key_type": types}, index=df.index)
    return out.astype("string")


def investor_key(df: pd.DataFrame, depository: str) -> pd.Series:
    """Vectorised fallback-chain key. Expects normalized pan1 / account cols."""
    return key_with_type(df, depository)["investor_key"]
