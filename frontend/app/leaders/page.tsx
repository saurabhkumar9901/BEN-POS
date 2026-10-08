import Link from "next/link";
import { Suspense } from "react";
import { fmtInt } from "@/lib/format";
import { leaders } from "@/lib/queries";
import { ConfidenceBadge, DataTable, SectionHeading } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export default function LeadersPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted">Loading leaders…</p>}>
      <LeadersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LeadersContent({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const mv = sp.minCompanies;
  const minCompanies = Math.max(1, Number(Array.isArray(mv) ? mv[0] : mv ?? "2") || 2);
  const rows = await leaders(minCompanies, 200);

  return (
    <div className="space-y-4 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          number="02"
          kicker="CROSS-COMPANY SIGNAL"
          title="Broadest investor footprint."
        />
        <form action="/leaders" method="get" className="flex items-center gap-2 font-mono text-[11px]">
          <label htmlFor="minc" className="text-muted">
            MIN COMPANIES
          </label>
          <Select id="minc" name="minCompanies" defaultValue={String(minCompanies)}>
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </Select>
          <Button type="submit">Apply</Button>
        </form>
      </div>
      <DataTable head={["#", "Investor", "Companies", "Positions", "Total qty", "Confidence"]}>
        {rows.map((r, i) => (
          <tr key={r.investor_key} className="transition-colors hover:bg-[#eeeadf]">
            <td className="px-3 py-[11px]">
              <span
                className={`inline-grid h-7 w-7 place-items-center font-mono text-[11px] font-extrabold ${
                  i < 3
                    ? ["bg-lime", "bg-orange", "bg-pink"][i] + " border border-ink"
                    : "text-muted"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </td>
            <td className="max-w-64 truncate px-3 py-[11px] text-[12px] font-bold">
              <Link href={`/shareholders/${r.investor_key}`} className="hover:underline">
                {r.name ?? "—"}
              </Link>
            </td>
            <td className="px-3 py-[11px] text-right text-[18px] font-extrabold">{fmtInt(r.n_companies)}</td>
            <td className="px-3 py-[11px] text-right">{fmtInt(r.n_positions)}</td>
            <td className="px-3 py-[11px] text-right">{fmtInt(r.total_qty)}</td>
            <td className="px-3 py-[11px]">
              <ConfidenceBadge level={r.identity_confidence} />
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-muted">
              No investors at this breadth.
            </td>
          </tr>
        )}
      </DataTable>
      <p className="border border-ink bg-[#e9e5da] px-4 py-[11px] font-mono text-[9px]/[1.45] text-muted">
        Share quantities are not summed across securities. This ranking measures portfolio
        breadth, not economic value.
      </p>
    </div>
  );
}
