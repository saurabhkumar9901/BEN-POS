"""Depository auto-detection by content sniffing (never trust filename)."""
from __future__ import annotations


def sniff_depository(sample: str) -> str:
    """Return 'nsdl' if ##-delimited, 'cdsl' if ~-delimited, else raise."""
    if "##" in sample:
        return "nsdl"
    if "~" in sample:
        return "cdsl"
    raise ValueError("Cannot detect depository: neither '##' nor '~' delimiter found")


def detect_file(path: str, probe_bytes: int = 65536) -> str:
    with open(path, "rb") as f:
        raw = f.read(probe_bytes)
    for enc in ("utf-8-sig", "cp1252"):
        try:
            sample = raw.decode(enc)
            return sniff_depository(sample)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return sniff_depository(raw.decode("utf-8", errors="replace"))
