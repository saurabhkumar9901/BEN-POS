"""PII masking for user-facing analytics (BRD Privacy by Design).

`unified` (internal) keeps everything needed for resolution.
`unified_safe` masks/drops direct identifiers but stays analytically complete:
geo (pin/state), quantities, depository, flags and investor_key all survive,
so screening, concentration, segmentation and network queries run unchanged.
"""
from __future__ import annotations

import pandas as pd

# Direct identifiers removed from the safe variant. investor_key stays
# as the join key; validation_flags stay (they name tests, not values).
SAFE_DROPS = [
    "account_id",
    "pan1", "pan2", "pan3",
    "address_full", "mobile", "email",
    "bank_name", "bank_acct", "micr",
]


def mask_name(s: pd.Series) -> pd.Series:
    """Deterministic A***T mask: first + last char, rest '*'.

    Same input always masks identically, so masked-name grouping still
    works. Single-char -> '*', empty/NA -> NA.
    """
    v = s.astype("string").fillna("").str.strip().str.upper()
    v = v.str.replace(r"[.\s]+$", "", regex=True)  # trailing dots add nothing
    n = v.str.len()
    stars = (n - 2).map(lambda k: "*" * max(int(k), 0))
    masked = v.str[:1] + stars + v.str[-1:]
    out = pd.Series(pd.NA, index=v.index, dtype="string")
    out = out.mask(n == 1, "*")
    out = out.mask(n >= 2, masked)
    return out


def make_safe(unified: pd.DataFrame) -> pd.DataFrame:
    """Derive the safe variant from a unified DataFrame."""
    safe = unified.copy()
    for col in ("holder1", "holder2", "holder3", "name_norm"):
        if col in safe:
            safe[col] = mask_name(safe[col])
    return safe.drop(columns=[c for c in SAFE_DROPS if c in safe.columns])
