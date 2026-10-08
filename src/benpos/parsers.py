"""Chunked raw parsers. One DataFrame chunk at a time; never load whole file.

NSDL: '##'-split, first line is the 01 summary (24 fields), rest 02 details (84).
CDSL: '~'-split, every line is data (104 fields), no header/trailer.
Short/long lines are padded/truncated to the canonical width so a single bad
row can never break a weekly run (parse-only stage: no validation).
"""
from __future__ import annotations

from typing import Iterator, Optional

import pandas as pd

from .schema import CDSL_COLUMNS, NSDL_COLUMNS, NSDL_HEADER_COLUMNS, NSDL_HEADER_RENAMES


def _iter_lines(path: str):
    """Yield decoded lines. Per-line utf-8 -> cp1252 fallback; never crashes a run."""
    with open(path, "rb") as f:
        for raw in f:
            try:
                yield raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                yield raw.decode("cp1252", errors="replace")


def _fit(fields: list[str], width: int) -> list[str]:
    if len(fields) < width:
        fields = fields + [""] * (width - len(fields))
    return fields[:width]


def parse_nsdl_chunks(
    path: str, chunksize: int = 100_000
) -> Iterator[tuple[pd.DataFrame, dict]]:
    """Yield (detail_chunk_df, file_meta). file_meta has isin/benpos_date/record_count."""
    meta: dict = {"isin": None, "benpos_date_raw": None, "record_count": None,
                  "trailer_qty": None}
    buf: list[list[str]] = []
    widths: list[int] = []
    rownum = 0  # 1-based source row number
    def _flush():
        df = pd.DataFrame(buf, columns=NSDL_COLUMNS)
        df["source_row"] = range(rownum - len(buf) + 1, rownum + 1)
        df["_raw_width"] = widths
        return df
    for raw_line in _iter_lines(path):
        line = raw_line.strip()
        if not line:
            continue
        rownum += 1
        parts = line.split("##")
        if rownum == 1 and parts[0].strip() == "01":
            h = _fit([p.strip() for p in parts], 24)
            meta = {
                "isin": h[1] or None,
                "benpos_date_raw": h[2] or None,
                "report_date_raw": h[3] or None,
                "report_time": h[4] or None,
                "trailer_qty": int(h[7]) if h[7].strip().lstrip("-").isdigit() else None,
                "record_count": int(h[23]) if h[23].strip().isdigit() else None,
            }
            continue
        widths.append(len(parts))
        buf.append(_fit([p.strip() for p in parts], 84))
        if len(buf) >= chunksize:
            yield _flush(), meta
            buf, widths = [], []
    if buf:
        yield _flush(), meta


def parse_cdsl_chunks(
    path: str, chunksize: int = 100_000
) -> Iterator[tuple[pd.DataFrame, dict]]:
    meta: dict = {"isin": None, "benpos_date_raw": None}
    buf: list[list[str]] = []
    widths: list[int] = []
    rownum = 0
    def _flush():
        df = pd.DataFrame(buf, columns=CDSL_COLUMNS)
        df["source_row"] = range(rownum - len(buf) + 1, rownum + 1)
        df["_raw_width"] = widths
        return df
    for raw_line in _iter_lines(path):
        line = raw_line.strip()
        if not line:
            continue
        rownum += 1
        parts = [p.strip() for p in line.split("~")]
        widths.append(len(parts))
        buf.append(_fit(parts, 104))
        if not meta["isin"] and len(buf) == 1:
            meta["isin"] = buf[0][0] or None
            meta["benpos_date_raw"] = buf[0][73] or None
        if len(buf) >= chunksize:
            yield _flush(), meta
            buf, widths = [], []
    if buf:
        if not meta["isin"]:
            meta["isin"] = buf[0][0] or None
            meta["benpos_date_raw"] = buf[0][73] or None
        yield _flush(), meta
