"""Corporate-action normalisation (BRD Sec 12).

Ingests BSE-style CA CSVs (Security Code, Security Name, ..., Ex Date, Purpose)
and reduces them to machine-usable events:

  action  bonus | split | dividend | rights | unclassified
  status  parsed (factor known) | needs_ratio | recorded | ignored | unclassified

Only bonus + split auto-adjust (mechanical for all holders). Rights are
recorded but never applied (subscription is optional). Dividends are ignored.

Restatement direction: adjusted_qty = qty x PRODUCT(factors with
ex_date AFTER the snapshot), i.e. old snapshots restated into current terms.
"""
from __future__ import annotations

import re

import pandas as pd

BONUS_RE = re.compile(r"bonus\D*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)", re.I)
SPLIT_RE = re.compile(
    r"(?:split|sub[\s-]?divis|face value|fv)[^\d]*"
    r"(\d+(?:\.\d+)?)\s*(?:to|/|->|into)\s*(?:re\.?|rs\.?)?\s?(\d+(?:\.\d+)?)",
    re.I,
)

HEADER_ALIASES = {
    "security code": "security_code",
    "security name": "security_name",
    "company name": "ca_company_name",
    "ex date": "ex_date",
    "ex-date": "ex_date",
    "purpose": "purpose",
    "record date": "record_date",
}


def _clean_headers(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [
        HEADER_ALIASES.get(re.sub(r"[\s\t]+", " ", str(c)).strip().lower(), str(c))
        for c in df.columns
    ]
    return df


def _classify(purpose: str) -> tuple[str, float | None, str]:
    """(action, factor, status) from a Purpose string."""
    p = (purpose or "").strip()
    if not p or p in ("-", "NA"):
        return ("unclassified", None, "unclassified")
    low = p.lower()
    if "dividend" in low or "interest" in low:
        return ("dividend", None, "ignored")
    if "rights" in low:
        return ("rights", None, "recorded")
    m = BONUS_RE.search(p)
    if m and "bonus" in low:
        a, b = float(m.group(1)), float(m.group(2))
        if b > 0:
            return ("bonus", (a + b) / b, "parsed")
        return ("bonus", None, "needs_ratio")
    if "bonus" in low:
        return ("bonus", None, "needs_ratio")
    m = SPLIT_RE.search(p)
    if m:
        old, new = float(m.group(1)), float(m.group(2))
        if new > 0:
            return ("split", old / new, "parsed")
        return ("split", None, "needs_ratio")
    if "split" in low or "sub-divis" in low or "face value" in low:
        return ("split", None, "needs_ratio")
    return ("unclassified", None, "unclassified")


def parse_ca_csv(path: str) -> pd.DataFrame:
    """Parse a BSE-style corporate-action CSV into a normalized events table."""
    raw = pd.read_csv(path, dtype=str, keep_default_na=False)
    df = _clean_headers(raw)
    missing = {"security_code", "security_name", "ex_date", "purpose"} - set(df.columns)
    if missing:
        raise ValueError(f"CA file missing columns: {sorted(missing)}")
    out = pd.DataFrame({
        "security_code": df["security_code"].str.strip(),
        "security_name": df.get("security_name", "").str.strip()
        if "security_name" in df else "",
        "ca_company_name": df.get("ca_company_name", "").str.strip()
        if "ca_company_name" in df else "",
        "purpose_raw": df["purpose"].str.strip(),
    })
    out["ex_date"] = pd.to_datetime(
        df["ex_date"].str.strip().replace("-", pd.NA), format="%d %b %Y", errors="coerce"
    ).dt.date
    classified = out["purpose_raw"].map(_classify)
    out["action"] = [c[0] for c in classified]
    out["factor"] = [c[1] for c in classified]
    out["status"] = [c[2] for c in classified]
    return out[
        ["security_code", "security_name", "ca_company_name", "ex_date",
         "purpose_raw", "action", "factor", "status"]
    ]


def load_security_code_map(path: str | None) -> dict:
    """{BSE security_code: isin} from company_map.csv's optional security_code column."""
    if not path:
        return {}
    m = pd.read_csv(path, dtype=str, keep_default_na=False)
    cols = {re.sub(r"\s+", "", c).lower(): c for c in m.columns}
    ic, sc = cols.get("isin"), cols.get("security_code")
    if not ic or not sc:
        return {}
    return {
        str(code).strip(): str(isin).strip()
        for code, isin in zip(m[sc], m[ic]) if str(code).strip()
    }


def resolve_isin(events: pd.DataFrame, code_to_isin: dict,
                 name_to_isin: dict) -> pd.DataFrame:
    """Attach isin: security_code match first, Security/Company Name fallback."""
    events = events.copy()

    def _one(r):
        code = str(r["security_code"]).strip()
        if code and code in code_to_isin:
            return code_to_isin[code], "code"
        for nm in (r["security_name"], r["ca_company_name"]):
            key = str(nm).strip().upper()
            if key and key in name_to_isin:
                return name_to_isin[key], "name"
        return None, "unresolved"

    resolved = events.apply(_one, axis=1, result_type="expand")
    events["isin"] = resolved[0]
    events["isin_via"] = resolved[1]
    return events


def snapshot_factors(events: pd.DataFrame, snapshots: pd.DataFrame) -> pd.DataFrame:
    """Per (isin, benpos_date) cumulative factor over parsed bonus/split events.

    snapshots: DataFrame with isin + benpos_date (ISO str) from holdings.
    factor = PRODUCT(parsed factors with ex_date AFTER the snapshot date).
    """
    parsed = events[(events["status"] == "parsed") & events["isin"].notna()].copy()
    rows = []
    pairs = snapshots[["isin", "benpos_date"]].drop_duplicates()
    for row in pairs.itertuples(index=False):
        snap = pd.to_datetime(row.benpos_date).date()
        ev = parsed[(parsed["isin"] == row.isin) & (parsed["ex_date"] > snap)]
        f = float(ev["factor"].prod()) if len(ev) else 1.0
        rows.append({"isin": row.isin, "benpos_date": snap.isoformat(), "ca_factor": f,
                     "n_ca_applied": len(ev)})
    return pd.DataFrame(rows, columns=["isin", "benpos_date", "ca_factor", "n_ca_applied"])
