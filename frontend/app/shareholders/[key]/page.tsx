import Link from "next/link";
import { Suspense } from "react";
import { fmtInt } from "@/lib/format";
import { shareholderProfile } from "@/lib/queries";
import { Card, ConfidenceBadge, DataTable, PageLink, StatCard } from "@/components/ui";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ShareholderPage({ params }: { params: Promise<{ key: string }> }) {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted">Loading investor…</p>}>
      <ShareholderContent params={params} />
    </Suspense>
  );
}

async function ShareholderContent({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^ik_[0-9a-f]{16}$/.test(key)) {
    return <p className="py-10 text-muted">Invalid investor key.</p>;
  }
  const { identity, portfolio } = await shareholderProfile(key);
  if (!identity) return <p className="py-10 text-muted">Unknown investor.</p>;

  const flagged = portfolio.filter((p) => p.validation_flags);
  const totalQty = portfolio.reduce((s, p) => s + Number(p.total_qty || 0), 0);
  const nDates = new Set(portfolio.map((p) => p.benpos_date)).size;

  return (
    <div className="space-y-4 pt-6">
      <div>
        <Link href="/shareholders" className="font-mono text-[10px] text-muted hover:text-ink hover:underline">
          ← INVESTORS
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-[clamp(28px,3.5vw,44px)] leading-none font-bold tracking-[-0.04em]">
          {identity.name ?? "—"} <ConfidenceBadge level={identity.identity_confidence} />
        </h1>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {identity.investor_key} · KEY TYPE {identity.key_type ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-[15px] md:grid-cols-4">
        <StatCard label="Companies held" value={fmtInt(portfolio.length)} />
        <StatCard label="Observed qty" value={fmtInt(totalQty)} sub="across held companies — breadth, not value" />
        <StatCard label="Snapshots" value={fmtInt(nDates)} sub="history depth" />
        <StatCard label="Flagged rows" value={fmtInt(flagged.length)} sub="validation flags" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current portfolio</CardTitle>
          <Badge variant="ink">{nDates <= 1 ? "1 SNAPSHOT" : `${nDates} SNAPSHOTS`}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable head={["Company", "ISIN", "Date", "Qty", "Depo", "Flags", ""]}>
            {portfolio.map((p, i) => (
              <tr key={`${p.isin}-${p.benpos_date}-${i}`} className="transition-colors hover:bg-[#eeeadf]">
                <td className="px-3 py-[11px]">
                  <PageLink href={`/companies/${p.isin}`}>{p.company_name ?? p.isin}</PageLink>
                </td>
                <td className="px-3 py-[11px] font-mono text-[11px] text-muted">{p.isin}</td>
                <td className="px-3 py-[11px] font-mono text-[11px] text-muted">{p.benpos_date}</td>
                <td className="px-3 py-[11px] text-right font-bold">{fmtInt(p.total_qty)}</td>
                <td className="px-3 py-[11px] font-mono text-[11px] text-muted">{p.depository}</td>
                <td className="px-3 py-[11px] font-mono text-[11px] text-[#a12917]">{p.validation_flags ?? ""}</td>
              <td className="px-3 py-[11px]">
                <Link
                  href={`/shareholders/${key}/${p.isin}?date=${p.benpos_date}`}
                  className="inline-grid h-[27px] w-[27px] place-items-center border border-ink hover:bg-lime"
                  aria-label="Position detail"
                >
                  →
                </Link>
              </td>
              </tr>
            ))}
            {portfolio.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  No positions.
                </td>
              </tr>
            )}
          </DataTable>
        </CardContent>
        {nDates <= 1 && (
          <p className="border-t border-line bg-[#e9e5da] px-4 py-[11px] font-mono text-[9px]/[1.45] text-muted">
            First seen / holding duration activate once a second weekly snapshot lands.
          </p>
        )}
      </Card>
    </div>
  );
}
