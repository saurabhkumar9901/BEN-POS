import Link from "next/link";
import { Suspense } from "react";
import { fmtInt, fmtPct } from "@/lib/format";
import { listCompanies } from "@/lib/queries";
import { DataTable, PageLink, SectionHeading } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SORTS = [
  ["holders", "Holders"],
  ["qty", "Total qty"],
  ["top10", "Top-10 %"],
  ["name", "Name"],
] as const;

function SortLink({
  k,
  label,
  base,
  active,
  dir,
}: {
  k: string;
  label: string;
  base: URLSearchParams;
  active: string;
  dir: string;
}) {
  const p = new URLSearchParams(base);
  p.set("sort", k);
  p.set("dir", active === k && dir === "desc" ? "asc" : "desc");
  p.set("page", "1");
  const arrow = active === k ? (dir === "desc" ? " ↓" : " ↑") : "";
  return (
    <Link href={`/companies?${p}`} className="hover:text-ink hover:underline">
      {label}
      {arrow}
    </Link>
  );
}

export default function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted">Loading companies…</p>}>
      <CompaniesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CompaniesContent({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v ?? undefined;
  };
  const q = get("q") ?? "";
  const sort = get("sort") ?? "holders";
  const dir = get("dir") ?? "desc";
  const page = Math.max(1, Number(get("page") ?? "1") || 1);

  const { rows, total } = await listCompanies({
    q: q || undefined,
    sort,
    dir,
    page,
    pageSize: 50,
  });
  const pages = Math.max(1, Math.ceil(Number(total) / 50));

  const base = new URLSearchParams();
  if (q) base.set("q", q);
  base.set("sort", sort);
  base.set("dir", dir);
  const pageHref = (p: number) => {
    const pp = new URLSearchParams(base);
    pp.set("page", String(p));
    return `/companies?${pp}`;
  };

  return (
    <div className="pt-6">
      <SectionHeading
        number="01"
        kicker="COMPANY LENS"
        title="Filter the universe by its owners."
        right={
          <span className="border border-ink bg-lime px-[9px] py-[7px] font-mono text-[10px] font-bold">
            {fmtInt(Number(total))} TRACKED
          </span>
        }
      />
      <form action="/companies" method="get" className="mb-4 flex max-w-xl gap-2">
        <Input name="q" defaultValue={q} placeholder="Search name or ISIN…" />
        <Button type="submit">Filter</Button>
      </form>
      <div className="mb-2 font-mono text-[10px] text-muted">
        SORT:{" "}
        {SORTS.map(([k, label]) => (
          <span key={k} className="mr-3">
            <SortLink k={k} label={label} base={base} active={sort} dir={dir} />
          </span>
        ))}
      </div>
      <DataTable head={["Company", "ISIN", "Holders", "Total qty", "CDSL %", "Top-10 %"]}>
        {rows.map((r) => (
          <tr key={r.isin} className="transition-colors hover:bg-[#eeeadf]">
            <td className="px-3 py-[11px]">
              <PageLink href={`/companies/${r.isin}`}>{r.company_name ?? r.isin}</PageLink>
            </td>
            <td className="px-3 py-[11px] font-mono text-[11px] text-muted">{r.isin}</td>
            <td className="px-3 py-[11px] text-right">{fmtInt(r.holder_count)}</td>
            <td className="px-3 py-[11px] text-right">{fmtInt(r.total_qty)}</td>
            <td className="px-3 py-[11px] text-right">
              {fmtPct((Number(r.cdsl_qty) / Number(r.total_qty)) * 100)}
            </td>
            <td className="px-3 py-[11px] text-right">{fmtPct(r.top10_pct)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-muted">
              No companies match.
            </td>
          </tr>
        )}
      </DataTable>
      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted">
        <span>
          PAGE {page} OF {pages}
        </span>
        <span className="space-x-2">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className="inline-block border border-ink bg-panel px-2 py-1 hover:bg-lime hover:text-ink"
            >
              ← PREV
            </Link>
          )}
          {page < pages && (
            <Link
              href={pageHref(page + 1)}
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
