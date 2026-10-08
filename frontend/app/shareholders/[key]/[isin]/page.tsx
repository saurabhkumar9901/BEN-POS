import Link from "next/link";
import { Suspense } from "react";
import { Lock, Mail, Phone } from "lucide-react";
import { fmtInt } from "@/lib/format";
import { companyStats, positionDetail, shareholderProfile, type PositionRow } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";

type SP = { [k: string]: string | string[] | undefined };

const cell = "border border-line p-[10px]";
const lab = "block font-mono text-[8px] uppercase text-muted";

function stateCells(p: PositionRow) {
  const total = Number(p.total_qty) || 0;
  if (p.depository === "cdsl") {
    const free = Number(p.free_qty) || 0;
    const pledged = Number(p.pledged_qty) || 0;
    const other = total - free - pledged;
    return [
      ["AVAILABLE", fmtInt(free)],
      ["PLEDGED", fmtInt(pledged)],
      ["OTHER LOCKED", fmtInt(other)],
    ];
  }
  const other = Number(p.nsdl_bucket_sum) || 0;
  return [
    ["AVAILABLE", fmtInt(total)],
    ["PLEDGED", "—"],
    ["IN REPORTED BUCKETS", fmtInt(other)],
  ];
}

function PositionPanel({ p, company }: { p: PositionRow; company: string }) {
  const cells = stateCells(p);
  return (
    <article className="border border-ink bg-panel">
      <div className="flex items-center justify-between border-b border-ink bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[10px] font-bold tracking-[0.16em]">
          POSITION DETAIL / {p.depository.toUpperCase()}
        </span>
        <span className="font-mono text-[10px] text-[#9fa198]">
          {company} · {p.source_file} · ROW {fmtInt(p.source_row)}
        </span>
      </div>

      <div className="m-[18px] grid gap-1 border-2 border-ink bg-lime p-[19px] shadow-[5px_5px_0_var(--color-ink)]">
        <span className="font-mono text-[9px] font-extrabold uppercase">Total position</span>
        <strong className="text-[39px] leading-none font-bold tracking-[-0.04em] tabular-nums">
          {fmtInt(p.total_qty)}
        </strong>
        <small className="font-mono text-[9px]">
          {p.depository.toUpperCase()} · ••••{p.account_suffix ?? "····"} ·{" "}
          {p.pan_reported ? "PAN reported" : "PAN not reported"}
        </small>
      </div>

      <div className="px-[19px] pb-[18px]">
        <h3 className="border-b border-ink pb-2 font-mono text-[10px] font-extrabold tracking-[0.12em]">
          POSITION STATE
        </h3>
        <div className="mt-2 grid grid-cols-3 border-t border-l border-line">
          {cells.map(([k, v]) => (
            <div key={k} className={`${cell} min-h-[68px]`}>
              <span className={lab}>{k}</span>
              <strong className="text-[13px] tabular-nums">{v}</strong>
            </div>
          ))}
        </div>
        {p.depository === "cdsl" && (
          <p className="mt-1 font-mono text-[8px]/[1.4] text-muted">
            Other = total − free − pledged (lock-in / NDU buckets not separately identified
            in CDSL feed).
          </p>
        )}
      </div>

      <div className="px-[19px] pb-[18px]">
        <h3 className="border-b border-ink pb-2 font-mono text-[10px] font-extrabold tracking-[0.12em]">
          ACCOUNT PROFILE
        </h3>
        <div className="mt-2 grid grid-cols-2 border-t border-l border-line">
          <div className={cell}>
            <span className={lab}>Second holder</span>
            <strong className="text-[11px]">{p.jh_name || "—"}</strong>
          </div>
          <div className={cell}>
            <span className={lab}>Date of birth</span>
            <strong className="text-[11px]">{p.dob || "Not reported"}</strong>
          </div>
          <div className={cell}>
            <span className={lab}>Status / Category</span>
            <strong className="text-[11px]">
              {[p.acc_status, p.acc_category].filter(Boolean).join(" / ") || "—"}
            </strong>
          </div>
          <div className={cell}>
            <span className={lab}>Type / Subtype</span>
            <strong className="text-[11px]">
              {[p.acc_type, p.acc_subtype].filter(Boolean).join(" / ") || "—"}
            </strong>
          </div>
        </div>
      </div>

      <div className="px-[19px] pb-[18px]">
        <h3 className="border-b border-ink pb-2 font-mono text-[10px] font-extrabold tracking-[0.12em]">
          LOCATION AND BANK
        </h3>
        <div className="mt-2 grid grid-cols-2 border-t border-l border-line">
          <div className={cell}>
            <span className={lab}>Location</span>
            <strong className="text-[11px]">{p.address_full || "—"}</strong>
          </div>
          <div className={cell}>
            <span className={lab}>Pincode</span>
            <strong className="text-[11px]">{p.pin || "—"}</strong>
          </div>
          <div className={cell}>
            <span className={lab}>Bank</span>
            <strong className="text-[11px]">{p.bank_name || "—"}</strong>
          </div>
          <div className={cell}>
            <span className={lab}>IFSC{ p.micr ? " / MICR" : ""}</span>
            <strong className="text-[11px]">
              {[p.ifsc, p.micr].filter(Boolean).join(" / ") || "—"}
            </strong>
          </div>
          <div className={cell}>
            <span className={lab}>Contact markers</span>
            <span className="flex gap-2">
              <Mail size={14} className={p.has_email ? "text-ink" : "text-line"} />
              <Phone size={14} className={p.has_phone ? "text-ink" : "text-line"} />
            </span>
          </div>
          <div className={cell}>
            <span className={lab}>Validation</span>
            <strong className="text-[11px] text-[#a12917]">{p.validation_flags || "clean"}</strong>
          </div>
        </div>
      </div>

      <div className="mx-[19px] mb-[19px] border border-ink bg-[#e7e3d8] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[8px] tracking-[0.12em] text-muted">
              RESTRICTED
            </span>
            <strong className="block text-[12px]">Account, PAN and contact</strong>
          </div>
          <span className="flex items-center gap-1 border border-ink bg-panel px-2 py-1 font-mono text-[9px] font-extrabold">
            <Lock size={12} /> GATED
          </span>
        </div>
        <p className="mt-1 font-mono text-[8px]/[1.4] text-muted">
          Full values suppressed in this UI — account ••••{p.account_suffix ?? "····"}, PAN{" "}
          {p.pan_reported ? "reported" : "not reported"}.
        </p>
      </div>
    </article>
  );
}

export default function PositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; isin: string }>;
  searchParams: Promise<SP>;
}) {
  return (
    <Suspense fallback={<p className="py-10 font-mono text-sm text-muted">Loading position…</p>}>
      <PositionContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PositionContent({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; isin: string }>;
  searchParams: Promise<SP>;
}) {
  const { key, isin } = await params;
  const sp = await searchParams;
  const dv = sp.date;
  const date = Array.isArray(dv) ? dv[0] : dv ?? undefined;
  if (!/^ik_[0-9a-f]{16}$/.test(key) || !/^INE[A-Z0-9]{9}$/.test(isin)) {
    return <p className="py-10 text-muted">Invalid key or ISIN.</p>;
  }
  const [{ identity }, rows] = await Promise.all([
    shareholderProfile(key),
    positionDetail(key, isin, date),
  ]);
  if (!identity || rows.length === 0) return <p className="py-10 text-muted">No position found.</p>;
  const company = await companyStats(isin, date);
  const cname = company?.company_name ?? isin;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pt-6">
      <div>
        <Link
          href={`/shareholders/${key}`}
          className="font-mono text-[10px] text-muted hover:text-ink hover:underline"
        >
          ← {identity.name ?? key}
        </Link>
        <h1 className="mt-1 text-[clamp(24px,3vw,36px)] leading-none font-bold tracking-[-0.04em]">
          {identity.name ?? "—"}
        </h1>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {cname} · {isin} · {rows.length} ACCOUNT{rows.length > 1 ? "S" : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Badge>SAFE VIEW</Badge>
      </div>
      {rows.map((p, i) => (
        <PositionPanel key={`${p.source_file}-${p.source_row}-${i}`} p={p} company={cname ?? isin} />
      ))}
    </div>
  );
}
