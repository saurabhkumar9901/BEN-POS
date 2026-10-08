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
`GitHub Actions` fed by `Supabase` staging. No PC, no schedule needed
(cron optional later).

```
browser → Vercel ──reads──▶ md:benpos
  │ uploads .txt/.csv ──PUT──▶ Supabase ──keys──▶ [Ingest now]
  │                                                  │ workflow_dispatch
  │                                                  ▼
  │                                         Actions worker: Supabase → process →
  │                                         build-db --motherduck → md:benpos
  │                                         (+ deletes staged keys: 1 GB discipline)
```

1. **MotherDuck**: create account + database `benpos`, make a token.
   Dual-write on every local rebuild (tables share the local view names,
   so frontend SQL is portable):
   `python -m benpos build-db --output processed --ca <file> --company-map company_map.csv --motherduck`
   (needs `MOTHERDUCK_TOKEN`; standalone re-sync anytime via
   `python -m benpos sync-md --output processed`).
2. **Supabase**: project → Storage → private bucket `benpos-drops` →
   service_role key + S3 access keys. Staging is transient: the worker
   deletes keys after a successful sync (1 GB free cap fits one drop).
3. **GitHub**: repo Settings → Secrets → Actions:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`,
   `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_KEY_ID`, `SUPABASE_S3_SECRET`,
   `SUPABASE_S3_REGION`, `MOTHERDUCK_TOKEN`, `MD_DATABASE=benpos`.
   PAT (`repo` + `workflow` scopes) → `GH_TOKEN` for Vercel below.
4. **Vercel**: import `frontend/`, set `DATA_SOURCE=motherduck`,
   `MOTHERDUCK_TOKEN`, `MD_DATABASE=benpos`,
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_BUCKET` (uploads),
   `NEXT_PUBLIC_INGEST_BACKEND=render`, `GH_TOKEN`, `GH_REPO=saurabhkumar9901/BEN-POS`.
5. Local dev stays offline: unset `DATA_SOURCE` (reads local
   `processed/`) and `NEXT_PUBLIC_INGEST_BACKEND` (local spawn ingest).

Secrets map: `MOTHERDUCK_TOKEN` (Vercel server + laptop + Actions),
`MD_DATABASE` (all three), Supabase keys (Vercel server + Actions),
`GH_TOKEN`/`GH_REPO` (Vercel server only).

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
