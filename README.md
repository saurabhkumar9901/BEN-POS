# BENPOS Preprocessing Pipeline

Parses weekly NSDL (`##`, 84 fields + `01` trailer) and CDSL (`~`, 104 fields, no header)
BENPOS files into partitioned Parquet. Pandas + Numpy (+ PyArrow for Parquet).

## Layout

- `data/` — raw weekly drops (any filenames; depository auto-detected by content)
- `src/benpos/` — package: `parsers` (chunked) · `schema` (column maps) · `normalize`
  (types) · `keys` (investor_key) · `validate` (flags + trailer checks) ·
  `privacy` (safe-variant masking) · `db` (DuckDB layer) ·
  `pipeline` (orchestration + manifest) · `cli`
- `processed/` — output, Hive-partitioned, append-only (never overwrite):
  `processed/benpos_date=YYYY-MM-DD/isin=INExxx/depository={nsdl,cdsl}_{full,unified}.parquet`
- `processed/_manifest.csv` — idempotency log (source_file, md5, isin, date, rows)
- `processed/validation_report.csv` — one row per file: rows, clean/flagged counts,
  per-flag counts, NSDL `01` trailer reconciliation (`trailer_count/trailer_qty`
  vs parsed, `count_match/qty_match`)
- `processed/benpos.duckdb` — query layer for the Python CLI (`stats` command):
  `holdings` / `holdings_safe` / `holdings_display` / `position_detail` views,
  `manifest` / `file_validation` views, `company_stats` table
- `processed/company_stats.csv`, `ca_events.csv`, `ca_snapshot_factors.csv` —
  flat exports refreshed by every `build-db`, so file-less readers never touch
  the `.duckdb` file and rebuilds can't collide with browsing

## Run

```powershell
$env:PYTHONPATH='src'
pip install -r requirements.txt
# parse raw files (default = process):
python -m benpos --input data --output processed
# with company names + CSV output alongside Parquet:
python -m benpos process --input data --output processed --company-map company_map.csv --emit both
# --emit parquet (default) | csv | both ;  --force reprocesses files already in _manifest.csv
# build query layer (views + company_stats):
python -m benpos build-db --output processed
# if the desk is open in a browser, the writer backs off instead of dying:
python -m benpos build-db --output processed --wait 120
# with corporate actions (BSE-format CSV; needs security_code in company_map.csv):
python -m benpos build-db --output processed --ca Corporate_Actions.csv --company-map company_map.csv
# inspect a company:
python -m benpos stats --output processed --isin INE039C01032 [--date 2026-07-17 --top 10]
```

## Frontend (`frontend/`)

Next.js 16 + TypeScript + Tailwind + Recharts, shadcn-style UI
(`components/ui/`, cva + tailwind-merge + lucide) in a paper/ink
command-desk theme (numbered sections, tone metric cards, company cards).
API routes + pages query **in-memory DuckDB over Parquet/CSV views**
(`lib/views.ts`, same definitions as the Python layer) via
`@duckdb/node-api` (the legacy `duckdb` npm package segfaults on Win/x64 —
do not use it). The frontend never opens `benpos.duckdb`, so `build-db`
rebuilds run cleanly mid-browsing. Connection pool (max 4, `BENPOS_POOL`)
+ 5-min TTL cache bust on every successful ingest. Native bindings stay
external in `next.config.ts`.

```powershell
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Pages: `/companies`, `/companies/[isin]` (360°: stats, depo mix,
concentration, top holders, quality strip), `/shareholders` (masked-name
search: full name `TRIVEDI` matches `T…I`), `/shareholders/[key]` (360°
profile + portfolio), `/leaders` (portfolio-breadth ranking),
`/holdings` (explorer: company/depository/normalized-state/min-qty filters),
`/admin` (ingest console: upload BENPOS .txt + CA .csv, run process /
rebuild DB with live log).
API: `/api/companies`, `/api/companies/[isin]` (+ `/holders`),
`/api/shareholders/search?q=`, `/api/shareholders/[key]` (+ `/positions`),
`/api/leaders`, `/api/holdings`, `/api/admin/*`.
UI reads `holdings_display`
(real holder names; PAN / account / phone / email suppressed to
presence-flags and masked suffixes) plus `position_detail`
(second holder, DOB, status/category/type, bank + branch + MICR/IFSC,
full address, pledged/free/bucket split, source file + row). States normalized in `lib/geo.ts`
(NSDL census codes + CDSL alias map → canonical / Outside India / Unknown).

## Deploy (free tier)

`Vercel (UI + API)` → `MotherDuck (hosted DuckDB)` · ingest via
`Render free FastAPI worker` fed by `R2` staging. No PC, no schedule needed
(cron optional later).

```
browser → Vercel ──reads──▶ md:benpos
  │ uploads .txt/.csv ──PUT──▶ R2 ──keys──▶ [Ingest now]
  │                                              │ POST /ingest
  │                                              ▼
  │                                     Render worker: R2 → process →
  │                                     build-db → sync-md → md:benpos
```

1. **MotherDuck**: create account + database `benpos`, make a token.
   Bootstrap once from the laptop:
   `python -m benpos sync-md --output processed` (needs `MOTHERDUCK_TOKEN`).
2. **R2**: bucket + API token (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`).
3. **Render**: Blueprint deploy from `render.yaml` (Docker, free tier),
   set `R2_*`, `MOTHERDUCK_TOKEN`, `MD_DATABASE=benpos` env vars.
4. **Vercel**: import `frontend/`, set `DATA_SOURCE=motherduck`,
   `MOTHERDUCK_TOKEN`, `MD_DATABASE=benpos`, `R2_*` (uploads),
   `NEXT_PUBLIC_INGEST_BACKEND=render`, `RENDER_INGEST_URL=<render url>`.
5. Local dev stays offline: unset `DATA_SOURCE` (reads local
   `processed/`) and `NEXT_PUBLIC_INGEST_BACKEND` (local spawn ingest).

Secrets map: `MOTHERDUCK_TOKEN` (Vercel server + laptop + Render),
`MD_DATABASE` (both), `R2_*` (Vercel server + Render),
`RENDER_INGEST_URL` (Vercel server only).

## Design decisions (grilled)

- Full parse always; curated `UNIFIED_COLUMNS` view for cross-depository analytics
- `isin`/`benpos_date` from file content; `source_file/source_row/depository` on every row
- Minimal coercion, no rejection: qty→Int64, dates→ISO, PAN upper, email lower, empty→NULL
- `investor_key` fallback chain: PAN1 → BOID / DPID+CLIENTID → name+dob/pin (SHA256, `ik_` prefix)
- Validation flags, no hard fails: `BAD_WIDTH, DUP_ACCOUNT, BAD_PAN, BAD_EMAIL,
  BAD_MOBILE, BAD_PIN, ZERO_QTY, PLEDGED_ONLY` (CDSL only) in `validation_flags`
  (`''` = clean); missing-value spellings (`N.A.`, `NIL`, `-`) → NULL, not flagged
- PII masking at write time: `*_unified_safe` (names → `A***T`, PAN/address/
  mobile/email/bank/account dropped; `investor_key`, pin, qty, flags kept) +
  `holdings_safe` view; `full` stays internal (audit trail)
- Identity confidence: `key_type` (`pan`/`acct`/`name`) + `identity_confidence`
  (`high`/`medium`/`low`); `xdp_holders`, `multi_accounts`, `identity_review`
  views in DuckDB (BRD Multi-Account Detection + manual-review queue)
- Corporate-action normalisation: `ca_events` (parsed/needs_ratio/recorded/
  ignored/unclassified) + `ca_snapshot_factors` + `holdings_adj` view
  (`adjusted_qty`; bonus `(a+b)/b`, split `old/new`, rights recorded-not-adjusted)
- BRD Sec 12 complete: validation, DuckDB, PII masking, identity confidence,
  corporate actions
