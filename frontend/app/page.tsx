import Link from "next/link";
import { Suspense } from "react";
import { Database, FileCheck2, Fingerprint, Sparkles, TrendingUp } from "lucide-react";
import { fmtAsOf, fmtCompact, fmtInt } from "@/lib/format";
import { companyAccent, leaders, listCompanies, overviewTotals } from "@/lib/queries";
import { Button } from "@/components/ui/button";

const ACCENT_BAR: Record<string, string> = {
  lime: "border-t-lime",
  orange: "border-t-orange",
  blue: "border-t-blue",
  pink: "border-t-pink",
};

const CARD_WASH: Record<string, string> = {
  lime: "bg-lime/15",
  orange: "bg-orange/15",
  blue: "bg-blue/15",
  pink: "bg-pink/15",
};

const RANK_TONE = ["bg-lime", "bg-orange", "bg-pink"];

export default function OverviewPage() {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted">Loading desk…</p>}>
      <OverviewContent />
    </Suspense>
  );
}

async function OverviewContent() {
  const [tot, comps, top] = await Promise.all([
    overviewTotals(),
    listCompanies({ sort: "qty", dir: "desc", page: 1, pageSize: 50 }),
    leaders(2, 10),
  ]);
  const cdslPct = tot.positions
    ? ((tot.cdslPositions / tot.positions) * 100).toFixed(1)
    : "0.0";
  const nsdlPct = tot.positions
    ? ((tot.nsdlPositions / tot.positions) * 100).toFixed(1)
    : "0.0";

  return (
    <div>
      {/* topbar */}
      <div className="flex min-h-[126px] items-center justify-between border-b-2 border-ink py-4">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-muted">
            BENEFICIARY POSITION / COMMAND DESK
          </span>
          <h1 className="mt-[7px] text-[clamp(31px,4vw,58px)] leading-[0.92] font-bold tracking-[-0.055em]">
            Ownership, <span className="bg-lime px-2">resolved.</span>
          </h1>
        </div>
        <div className="grid gap-1 text-right">
          <span className="font-mono text-[9px] font-bold tracking-[0.16em] text-muted">
            DATASET AS OF
          </span>
          <strong className="font-mono text-[18px] font-extrabold">
            {fmtAsOf(tot.latestDate)}
          </strong>
          <small className="font-mono text-[9px] font-bold text-[#367c32]">
            <span className="mr-1 inline-block h-[7px] w-[7px] rounded-full bg-[#55b94e]" />
            LIVE LOCAL
          </small>
        </div>
      </div>

      {/* privacy ribbon */}
      <div className="my-[18px] flex min-h-[38px] items-center gap-[9px] border border-line bg-[#e6e2d7] px-3 py-[7px] text-[11px]">
        <span className="font-mono text-[10px] font-extrabold tracking-[0.08em]">
          PII-SAFE VIEW
        </span>
        <p className="m-0 text-muted">
          Names visible for authorized research. PAN, account, phone and email masked
          or suppressed.
        </p>
      </div>

      {/* 01 network overview */}
      <section>
        <div className="mb-[18px] flex items-end justify-between">
          <div className="flex items-start gap-[13px]">
            <span className="bg-ink px-[6px] py-[5px] font-mono text-[11px] font-extrabold text-white">
              01
            </span>
            <div>
              <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-muted">
                NETWORK OVERVIEW
              </span>
              <h2 className="mt-1 text-[22px] font-bold tracking-[-0.025em]">
                {tot.nCompanies} companies. One ownership map.
              </h2>
            </div>
          </div>
          <span className="flex items-center gap-[6px] border border-ink bg-lime px-[9px] py-[7px] font-mono text-[10px] font-bold">
            <FileCheck2 size={15} /> {fmtInt(tot.filesReconciled)} FILES RECONCILED
          </span>
        </div>
        <div className="grid gap-[15px] md:grid-cols-2 xl:grid-cols-4">
          <Metric tone="ink" label="POSITION RECORDS" value={fmtInt(tot.positions)} sub="CDSL + NSDL account-security rows" icon={<Database size={19} />} />
          <Metric tone="lime" label="RESOLVED IDENTITIES" value={fmtInt(tot.identities)} sub="Distinct investor keys" icon={<Fingerprint size={19} />} />
          <Metric tone="orange" label="CROSS-COMPANY" value={fmtInt(tot.crossCompany)} sub="Present in two or more companies" icon={<TrendingUp size={19} />} />
          <Metric tone="pink" label="FULL BREADTH" value={fmtInt(tot.fullBreadth)} sub={`Present in all ${tot.nCompanies} companies`} icon={<Sparkles size={19} />} />
        </div>
      </section>

      {/* 02 company lens */}
      <section className="mt-11">
        <div className="mb-[18px] flex items-center">
          <div className="flex items-start gap-[13px]">
            <span className="bg-ink px-[6px] py-[5px] font-mono text-[11px] font-extrabold text-white">
              02
            </span>
            <div>
              <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-muted">
                COMPANY LENS
              </span>
              <h2 className="mt-1 text-[22px] font-bold tracking-[-0.025em]">
                Select an issuer to narrow the desk.
              </h2>
            </div>
          </div>
        </div>
        <div className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-4">
          {comps.rows.map((c, i) => {
            const accent = companyAccent(c.isin);
            const cdslPct = Number(c.total_qty)
              ? (Number(c.cdsl_qty) / Number(c.total_qty)) * 100
              : 0;
            return (
              <Link
                key={c.isin}
                href={`/companies/${c.isin}`}
                className={`block border border-ink border-t-8 p-[15px] text-left transition-transform hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-[5px_5px_0_var(--color-ink)] ${ACCENT_BAR[accent]} ${CARD_WASH[accent]}`}
              >
                <span className="font-mono text-[10px] font-extrabold text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-[17px] block font-mono text-[9px] text-muted">{c.isin}</span>
                <h3 className="mt-[3px] mb-[18px] text-[21px] font-bold">{c.company_name ?? c.isin}</h3>
                <div className="flex justify-between font-mono text-[9px] text-muted">
                  <span>{fmtCompact(c.total_qty)} shares</span>
                  <span>{fmtCompact(c.holder_count)} positions</span>
                </div>
                <div className="my-[10px] h-2 border border-ink bg-[#d9d5ca]" aria-label={`${cdslPct.toFixed(1)} percent CDSL positions`}>
                  <span className="block h-full bg-ink" style={{ width: `${cdslPct}%` }} />
                </div>
                <div className="flex justify-between font-mono text-[9px] text-muted">
                  <span>CDSL {fmtInt(c.cdsl_holders)}</span>
                  <span>NSDL {fmtInt(c.nsdl_holders)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* leaderboard + depo mix */}
      <section className="mt-[38px] grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <article className="border border-ink bg-panel">
          <div className="flex min-h-[72px] items-center justify-between border-b border-ink px-[17px] py-[15px]">
            <div>
              <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-muted">
                CROSS-COMPANY SIGNAL
              </span>
              <h2 className="mt-1 text-[19px] font-bold">Broadest investor footprint</h2>
            </div>
            <span className="border border-line p-[6px] font-mono text-[9px]">
              Ranked by distinct companies
            </span>
          </div>
          <div className="px-[17px] py-[5px]">
            {top.map((t, i) => (
              <Link
                key={t.investor_key}
                href={`/shareholders/${t.investor_key}`}
                className="grid min-h-[58px] grid-cols-[30px_minmax(180px,1fr)_44px] items-center gap-[10px] border-b border-[#dedacf] py-1 hover:bg-[#eeeadf]"
              >
                <span
                  className={`grid h-7 w-7 place-items-center font-mono text-[11px] font-extrabold ${
                    i < 3 ? `${RANK_TONE[i]} border border-ink` : "text-muted"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="grid min-w-0 gap-1">
                  <strong className="truncate text-[12px]">{t.name ?? "—"}</strong>
                  <span className="font-mono text-[9px] text-muted">
                    {t.n_positions} positions
                  </span>
                </div>
                <strong className="text-right font-mono text-[18px] font-extrabold">
                  {t.n_companies}
                  <small className="text-[9px] font-bold text-muted">/{tot.nCompanies}</small>
                </strong>
              </Link>
            ))}
          </div>
          <p className="m-0 bg-[#e9e5da] px-[17px] py-[11px] font-mono text-[9px]/[1.45] text-muted">
            Ranking measures portfolio breadth, not economic value.{" "}
            <Link href="/leaders" className="font-bold text-ink underline">
              Full ranking →
            </Link>
          </p>
        </article>

        <article className="border border-ink bg-panel">
          <div className="flex min-h-[72px] items-center justify-between border-b border-ink px-[17px] py-[15px]">
            <div>
              <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-muted">
                DEPOSITORY MIX
              </span>
              <h2 className="mt-1 text-[19px] font-bold">The source population</h2>
            </div>
          </div>
          <div className="grid gap-[13px] p-[18px]">
            <div className="grid grid-cols-[1fr_auto] gap-[2px] border border-ink p-[14px]">
              <span className="font-mono text-[11px] font-extrabold">CDSL</span>
              <strong className="row-span-2 text-[24px] font-bold tabular-nums">
                {fmtInt(tot.cdslPositions)}
              </strong>
              <small className="font-mono text-[9px] text-muted">position records</small>
              <div className="col-span-full mt-[10px] h-[5px] bg-[#dedacf]">
                <span className="block h-full bg-orange" style={{ width: `${cdslPct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-[2px] border border-ink p-[14px]">
              <span className="font-mono text-[11px] font-extrabold">NSDL</span>
              <strong className="row-span-2 text-[24px] font-bold tabular-nums">
                {fmtInt(tot.nsdlPositions)}
              </strong>
              <small className="font-mono text-[9px] text-muted">position records</small>
              <div className="col-span-full mt-[10px] h-[5px] bg-[#dedacf]">
                <span className="block h-full bg-blue" style={{ width: `${nsdlPct}%` }} />
              </div>
            </div>
            <div className="flex gap-[9px] bg-lime p-[10px]">
              <p className="m-0 grid font-mono text-[9px]/[1.4]">
                <strong>One canonical view</strong>
                Native depository fields remain traceable to source lines.
              </p>
            </div>
            <Button asChild variant="dark">
              <Link href="/holdings">Interrogate positions →</Link>
            </Button>
          </div>
        </article>
      </section>

      <footer className="mt-7 flex justify-between border-t-2 border-ink py-[18px] font-mono text-[9px] text-muted">
        <span>BEN/POS LOCAL RESEARCH DESK</span>
        <p className="m-0">Canonical model v1 · Source values retained · Do not distribute personal data</p>
      </footer>
    </div>
  );
}

function Metric({
  tone,
  label,
  value,
  sub,
  icon,
}: {
  tone: "ink" | "lime" | "orange" | "pink";
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  const tones = {
    ink: "bg-ink text-white",
    lime: "bg-lime text-ink",
    orange: "bg-orange text-ink",
    pink: "bg-pink text-ink",
  } as const;
  return (
    <article className={`relative min-h-[154px] overflow-hidden border-2 border-ink p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between font-mono text-[9px] font-bold tracking-[0.13em]">
        <span>{label}</span>
        <span className="grid h-[30px] w-[30px] place-items-center border border-current">{icon}</span>
      </div>
      <strong className="mt-[18px] block text-[clamp(29px,3vw,44px)] leading-none font-bold tracking-[-0.05em] tabular-nums">
        {value}
      </strong>
      <p className="mt-[7px] max-w-[210px] font-mono text-[10px]/[1.4] opacity-70">{sub}</p>
    </article>
  );
}
