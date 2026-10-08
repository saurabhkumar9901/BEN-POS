import Link from "next/link";
import { Suspense } from "react";
import { fmtInt } from "@/lib/format";
import { leaders, searchShareholders } from "@/lib/queries";
import { ConfidenceBadge, DataTable, PageLink, SectionHeading } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SP = { [k: string]: string | string[] | undefined };

export default function ShareholdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted">Loading…</p>}>
      <ShareholdersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ShareholdersContent({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const qv = sp.q;
  const q = (Array.isArray(qv) ? qv[0] : qv ?? "").trim();
  const [rows, top] = await Promise.all([
    q.length >= 2 ? searchShareholders(q, 50) : Promise.resolve([]),
    q ? Promise.resolve([]) : leaders(2, 10),
  ]);

  return (
    <div className="space-y-4 pt-6">
      <SectionHeading
        number="01"
        kicker="INVESTORS"
        title="Search resolved identities."
        right={
          <span className="border border-ink bg-lime px-[9px] py-[7px] font-mono text-[10px] font-bold text-ink">
            NAMES VISIBLE · PII SUPPRESSED
          </span>
        }
      />
      <form action="/shareholders" method="get" className="flex max-w-xl gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Full name, e.g. TRIVEDI, or investor key…"
        />
        <Button type="submit">Search</Button>
      </form>
      {q.length < 2 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Widest portfolios</h2>
            <Link href="/leaders" className="font-mono text-[10px] font-bold text-ink underline">
              FULL RANKING →
            </Link>
          </div>
          <DataTable head={["Investor", "Companies", "Total qty"]}>
            {top.map((r) => (
              <tr key={r.investor_key} className="transition-colors hover:bg-[#eeeadf]">
                <td className="max-w-64 truncate px-3 py-[11px]">
                  <PageLink href={`/shareholders/${r.investor_key}`}>{r.name ?? "—"}</PageLink>
                </td>
                <td className="px-3 py-[11px] text-right font-bold">{fmtInt(r.n_companies)}</td>
                <td className="px-3 py-[11px] text-right">{fmtInt(r.total_qty)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
      {q.length >= 2 && (
        <DataTable head={["Investor", "Companies", "Total qty", "Confidence", "Key"]}>
          {rows.map((r) => (
            <tr key={r.investor_key} className="transition-colors hover:bg-[#eeeadf]">
              <td className="max-w-64 truncate px-3 py-[11px]">
                <PageLink href={`/shareholders/${r.investor_key}`}>{r.name ?? "—"}</PageLink>
              </td>
              <td className="px-3 py-[11px] text-right">{fmtInt(r.n_companies)}</td>
              <td className="px-3 py-[11px] text-right">{fmtInt(r.total_qty)}</td>
              <td className="px-3 py-[11px]">
                <ConfidenceBadge level={r.identity_confidence} />
              </td>
              <td className="px-3 py-[11px] font-mono text-[11px] text-muted">{r.investor_key}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-muted">
                No investors match “{q}”.
              </td>
            </tr>
          )}
        </DataTable>
      )}
    </div>
  );
}
