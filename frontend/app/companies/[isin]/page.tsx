import Link from "next/link";
import { Suspense } from "react";
import { Database, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { fmtInt, fmtPct } from "@/lib/format";
import { caFactor, companyQuality, companyStats, distinctCompanyStates, snapshotDates, topHolders } from "@/lib/queries";
import { Card, ConfidenceBadge, DataTable, PageLink, QualityStrip, StatCard } from "@/components/ui";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConcentrationChart, DepoMixChart } from "@/components/Charts";
import { DateSelect } from "@/components/DateSelect";

type SP = { [k: string]: string | string[] | undefined };

export default function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ isin: string }>;
  searchParams: Promise<SP>;
}) {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted">Loading company…</p>}>
      <CompanyContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CompanyContent({
  params,
  searchParams,
}: {
  params: Promise<{ isin: string }>;
  searchParams: Promise<SP>;
}) {
  const { isin } = await params;
  const sp = await searchParams;
  const dv = sp.date;
  const dates = await snapshotDates();
  const date = (Array.isArray(dv) ? dv[0] : dv) ?? dates[0];
  if (!date) return <p className="py-10 text-muted">No snapshots loaded.</p>;

  // Fast CSV lookups paint the shell immediately; the heavy holders
  // aggregation streams in below via its own Suspense boundary instead of
  // blocking the whole page (previously one await-all = 11s+ blank RSC).
  const [stats, quality, factor] = await Promise.all([
    companyStats(isin, date),
    companyQuality(isin, date),
    caFactor(isin, date),
  ]);
  if (!stats) return <p className="py-10 text-muted">Unknown ISIN.</p>;
  const hv = sp.hpage;
  const hpage = Math.max(1, Number(Array.isArray(hv) ? hv[0] : hv ?? "1") || 1);
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v ?? "";
  };
  const hq = one("hq").trim();
  const hdepo = one("hdepo");
  const hstate = one("hstate");
  const hmin = Math.max(0, Number(one("hmin") || "0") || 0);

  const cleanPct =
    quality && Number(quality.rows) > 0
      ? fmtPct((Number(quality.clean_rows) / Number(quality.rows)) * 100)
      : "—";

  return (
    <div className="space-y-4 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/companies" className="font-mono text-[10px] text-muted hover:text-ink hover:underline">
            ← COMPANIES
          </Link>
          <h1 className="mt-1 text-[clamp(28px,3.5vw,44px)] leading-none font-bold tracking-[-0.04em]">
            {stats.company_name ?? stats.isin}{" "}
            <span className="font-mono text-sm font-normal text-muted">{stats.isin}</span>
          </h1>
        </div>
        <DateSelect dates={dates} value={date} />
      </div>

      <QualityStrip
        cleanPct={cleanPct}
        countMatch={quality?.count_match ?? null}
        qtyMatch={quality?.qty_match ?? null}
        caFactor={factor}
      />

      <div className="grid grid-cols-2 gap-[15px] md:grid-cols-4">
        <StatCard label="Holders" value={fmtInt(stats.holder_count)} sub={`${fmtInt(stats.clean_holder_count)} clean`} />
        <StatCard label="Total qty" value={fmtInt(stats.total_qty)} />
        <StatCard
          label="CDSL / NSDL"
          value={`${fmtInt(stats.cdsl_holders)} / ${fmtInt(stats.nsdl_holders)}`}
          sub="holders"
        />
        <StatCard label="Top-10 share" value={fmtPct(stats.top10_pct)} sub={`Top-50 ${fmtPct(stats.top50_pct)} · Top-100 ${fmtPct(stats.top100_pct)}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Depository mix (qty)</CardTitle>
          </CardHeader>
          <CardContent>
            <DepoMixChart cdslQty={Number(stats.cdsl_qty)} nsdlQty={Number(stats.nsdl_qty)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Concentration</CardTitle>
          </CardHeader>
          <CardContent>
            <ConcentrationChart top10={Number(stats.top10_pct)} top50={Number(stats.top50_pct)} top100={Number(stats.top100_pct)} />
          </CardContent>
        </Card>
      </div>

      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>Top holders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="py-8 font-mono text-sm text-muted">Scanning 303k positions…</p>
            </CardContent>
          </Card>
        }
      >
        <CompanyHolders
          isin={isin}
          date={date}
          totalQty={Number(stats.total_qty)}
          hpage={hpage}
          hq={hq}
          hdepo={hdepo}
          hstate={hstate}
          hmin={hmin}
        />
      </Suspense>
    </div>
  );
}

async function CompanyHolders({
  isin,
  date,
  totalQty,
  hpage,
  hq,
  hdepo,
  hstate,
  hmin,
}: {
  isin: string;
  date: string;
  totalQty: number;
  hpage: number;
  hq: string;
  hdepo: string;
  hstate: string;
  hmin: number;
}) {
  const HPAGE = 25;
  const [holders, hstates] = await Promise.all([
    topHolders(isin, date, HPAGE, (hpage - 1) * HPAGE, {
      q: hq || undefined,
      depo: hdepo || undefined,
      minQty: hmin,
      state: hstate || undefined,
    }),
    distinctCompanyStates(isin, date),
  ]);
  const hpages = Math.max(1, Math.ceil(Number(holders.total) / HPAGE));
  const hHref = (p: number) =>
    `/companies/${isin}?date=${date}&hpage=${p}` +
    (hq ? `&hq=${encodeURIComponent(hq)}` : "") +
    (hdepo ? `&hdepo=${hdepo}` : "") +
    (hstate ? `&hstate=${encodeURIComponent(hstate)}` : "") +
    (hmin ? `&hmin=${hmin}` : "");
  const resetHref = `/companies/${isin}?date=${date}`;

  return (
      <Card>
        <CardHeader>
          <CardTitle>
            Top holders{" "}
            <span className="font-mono text-[10px] font-normal text-muted">
              ({fmtInt(holders.total)} matching)
            </span>
          </CardTitle>
          <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
            PAGE {Math.min(hpage, hpages)} OF {hpages}
            {hpage > 1 && (
              <Link
                href={hHref(hpage - 1)}
                className="inline-block border border-ink bg-panel px-2 py-1 text-ink hover:bg-lime"
              >
                ← PREV
              </Link>
            )}
            {hpage < hpages && (
              <Link
                href={hHref(hpage + 1)}
                className="inline-block border border-ink bg-panel px-2 py-1 text-ink hover:bg-lime"
              >
                NEXT →
              </Link>
            )}
          </span>
        </CardHeader>
        <form
          action={`/companies/${isin}`}
          method="get"
          className="flex flex-wrap gap-2 border-b border-ink bg-ink p-[10px]"
        >
          <input type="hidden" name="date" value={date} />
          <label className="flex min-h-[38px] flex-[310px] items-center gap-2 bg-white px-[10px]">
            <Search size={15} className="shrink-0 text-muted" />
            <input
              name="hq"
              defaultValue={hq}
              placeholder="Holder name"
              className="w-full min-w-0 border-0 bg-transparent text-[12px] outline-none placeholder:text-muted"
            />
          </label>
          <label className="flex min-h-[38px] min-w-[150px] items-center gap-2 bg-white px-[10px]">
            <Database size={13} className="shrink-0 text-muted" />
            <select
              name="hdepo"
              defaultValue={hdepo}
              className="w-full cursor-pointer appearance-none border-0 bg-transparent pr-4 text-[12px] outline-none"
            >
              <option value="">All depositories</option>
              <option value="cdsl">CDSL</option>
              <option value="nsdl">NSDL</option>
            </select>
          </label>
          <label className="flex min-h-[38px] min-w-[150px] items-center gap-2 bg-white px-[10px]">
            <MapPin size={13} className="shrink-0 text-muted" />
            <select
              name="hstate"
              defaultValue={hstate}
              className="w-full cursor-pointer appearance-none border-0 bg-transparent pr-4 text-[12px] outline-none"
            >
              <option value="">All states</option>
              {hstates.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state} ({fmtInt(s.n)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-[38px] w-[150px] items-center gap-2 bg-white px-[10px]">
            <SlidersHorizontal size={13} className="shrink-0 text-muted" />
            <input
              name="hmin"
              defaultValue={hmin || ""}
              placeholder="Min. holding"
              inputMode="numeric"
              className="w-full min-w-0 border-0 bg-transparent text-[12px] outline-none placeholder:text-muted"
            />
          </label>
          {(hq || hdepo || hstate || hmin) && (
            <Link
              href={resetHref}
              className="flex min-h-[38px] items-center gap-[5px] border border-white bg-orange px-3 font-mono text-[10px] font-extrabold text-ink"
            >
              <X size={14} /> RESET
            </Link>
          )}
          <button
            type="submit"
            className="min-h-[38px] border border-white bg-lime px-3 font-mono text-[10px] font-extrabold text-ink"
          >
            APPLY
          </button>
        </form>
        <DataTable head={["Holder", "Qty", "Share", "Depo", "Confidence", "Key"]}>
          {holders.rows.map((h) => (
            <tr key={h.investor_key + h.depo} className="transition-colors hover:bg-[#eeeadf]">
              <td className="max-w-64 truncate px-3 py-[11px]">
                <PageLink href={`/shareholders/${h.investor_key}`}>{h.name ?? "—"}</PageLink>
              </td>
              <td className="px-3 py-[11px] text-right font-bold">{fmtInt(h.qty)}</td>
              <td className="px-3 py-[11px] text-right">
                {fmtPct((Number(h.qty) / totalQty) * 100)}
              </td>
              <td className="px-3 py-[11px] font-mono text-[11px] text-muted">{h.depo}</td>
              <td className="px-3 py-[11px]">
                <ConfidenceBadge level={h.identity_confidence} />
              </td>
              <td className="px-3 py-[11px] font-mono text-[11px] text-muted">{h.investor_key}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
  );
}
