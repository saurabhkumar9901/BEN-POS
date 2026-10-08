import Link from "next/link";
import { Suspense } from "react";
import { fmtInt } from "@/lib/format";
import { distinctStates, holdingsExplorer, listCompanies } from "@/lib/queries";
import { DataTable, PageLink, SectionHeading } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type SP = { [k: string]: string | string[] | undefined };

export default function HoldingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted">Loading holdings…</p>}>
      <HoldingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HoldingsContent({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v ?? "";
  };
  const f = {
    isin: get("isin"),
    depo: get("depo"),
    state: get("state"),
    minQty: Number(get("minQty") || "0") || 0,
    sort: get("sort") || "qty",
    dir: get("dir") || "desc",
    page: Math.max(1, Number(get("page") || "1") || 1),
  };
  const [companies, states, { rows, total }] = await Promise.all([
    listCompanies({ sort: "name", dir: "asc", page: 1, pageSize: 200 }),
    distinctStates(),
    holdingsExplorer({ ...f, pageSize: 50 }),
  ]);
  const pages = Math.max(1, Math.ceil(Number(total) / 50));
  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (k !== "page" && v) keep.set(k, String(v));
  }
  const pageHref = (p: number) => {
    const pp = new URLSearchParams(keep);
    pp.set("page", String(p));
    return `/holdings?${pp}`;
  };

  return (
    <div className="space-y-4 pt-6">
      <SectionHeading
        number="03"
        kicker="HOLDINGS EXPLORER"
        title="Interrogate every canonical position."
        right={
          <span className="border border-ink bg-panel px-[9px] py-[7px] font-mono text-[10px] font-bold">
            {fmtInt(Number(total))} LOADED ROWS
          </span>
        }
      />
      <form
        action="/holdings"
        method="get"
        className="flex flex-wrap gap-2 border border-ink border-b-0 bg-ink p-[10px]"
      >
        <Select name="isin" defaultValue={f.isin} className="min-w-[170px]">
          <option value="">All companies</option>
          {companies.rows.map((c) => (
            <option key={c.isin} value={c.isin}>
              {c.company_name ?? c.isin}
            </option>
          ))}
        </Select>
        <Select name="depo" defaultValue={f.depo}>
          <option value="">All depositories</option>
          <option value="cdsl">CDSL</option>
          <option value="nsdl">NSDL</option>
        </Select>
        <Select name="state" defaultValue={f.state} className="min-w-[170px]">
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s.state} value={s.state}>
              {s.state} ({fmtInt(s.n)})
            </option>
          ))}
        </Select>
        <Input
          name="minQty"
          defaultValue={f.minQty || ""}
          placeholder="Min. holding"
          inputMode="numeric"
          className="w-[150px]"
        />
        <Button type="submit" variant="danger">
          Apply
        </Button>
      </form>
      <div className="-mt-4 border border-t-0 border-ink bg-panel px-[13px] py-[10px] font-mono text-[9px] text-muted">
        ALL COMPANIES · SORTED BY HOLDING QUANTITY · STATES NORMALIZED
      </div>
      <DataTable head={["Holder / account", "Company", "Depository", "Total", "State", "Flags"]}>
        {rows.map((r, i) => (
          <tr key={`${r.investor_key}-${r.isin}-${i}`} className="transition-colors hover:bg-[#eeeadf]">
            <td className="max-w-[270px] px-3 py-[11px]">
              <PageLink href={`/shareholders/${r.investor_key}`}>{r.holder ?? "—"}</PageLink>
            </td>
            <td className="px-3 py-[11px]">
              <PageLink href={`/companies/${r.isin}`}>{r.company_name ?? r.isin}</PageLink>
            </td>
            <td className="px-3 py-[11px]">
              <span
                className={
                  r.depository === "cdsl"
                    ? "text-[#b54008]"
                    : "text-[#2849c5]"
                }
              >
                <span className="inline-flex border border-current px-[6px] py-1 font-mono text-[8px] font-extrabold uppercase">
                  {r.depository}
                </span>
              </span>
            </td>
            <td className="px-3 py-[11px] text-right font-extrabold">{fmtInt(r.total_qty)}</td>
            <td className="px-3 py-[11px] text-[11px] text-muted">{r.state_norm}</td>
            <td className="px-3 py-[11px] font-mono text-[11px] text-[#a12917]">
              {r.validation_flags ?? ""}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-muted">
              No positions match these filters.
            </td>
          </tr>
        )}
      </DataTable>
      <div className="flex items-center justify-between font-mono text-[11px] text-muted">
        <span>
          PAGE {f.page} OF {pages}
        </span>
        <span className="space-x-2">
          {f.page > 1 && (
            <Link
              href={pageHref(f.page - 1)}
              className="inline-block border border-ink bg-panel px-2 py-1 hover:bg-lime hover:text-ink"
            >
              ← PREV
            </Link>
          )}
          {f.page < pages && (
            <Link
              href={pageHref(f.page + 1)}
              className="inline-block border border-ink bg-panel px-2 py-1 hover:bg-lime hover:text-ink"
            >
              NEXT →
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}
