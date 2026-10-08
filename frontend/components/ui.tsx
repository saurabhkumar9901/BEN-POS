import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

/* Micro-label kicker, e.g. "NETWORK OVERVIEW" */
export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] font-bold tracking-[0.16em] text-muted uppercase",
        className
      )}
    >
      {children}
    </span>
  );
}

/* Numbered section heading: 01 / KICKER / Title ............ right slot */
export function SectionHeading({
  number,
  kicker,
  title,
  right,
  compact = false,
}: {
  number: string;
  kicker: string;
  title: string;
  right?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("mb-[18px] flex justify-between", compact ? "items-center" : "items-end")}>
      <div className="flex items-start gap-[13px]">
        <span className="bg-ink px-[6px] py-[5px] font-mono text-[11px] font-extrabold text-white">
          {number}
        </span>
        <div>
          <Kicker>{kicker}</Kicker>
          <h2 className="mt-1 text-[22px] font-bold tracking-[-0.025em]">{title}</h2>
        </div>
      </div>
      {right}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("border border-ink bg-panel", className)}>{children}</div>;
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-ink bg-panel p-4">
      <div className="font-mono text-[9px] font-bold tracking-[0.13em] text-muted uppercase">
        {label}
      </div>
      <div className="mt-4 text-[clamp(29px,3vw,40px)] leading-none font-bold tracking-[-0.05em] tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-[7px] font-mono text-[10px]/[1.4] text-muted">{sub}</div>}
    </div>
  );
}

/* Tone metric card (overview hero): ink | lime | orange | pink */
const TONES: Record<string, string> = {
  ink: "bg-ink text-white",
  lime: "bg-lime text-ink",
  orange: "bg-orange text-ink",
  pink: "bg-pink text-ink",
};

export function MetricCard({
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
  icon?: ReactNode;
}) {
  return (
    <article className={cn("relative min-h-[154px] overflow-hidden border-2 border-ink p-4", TONES[tone])}>
      <div className="flex items-center justify-between font-mono text-[9px] font-bold tracking-[0.13em] uppercase">
        <span>{label}</span>
        {icon && (
          <span className="grid h-[30px] w-[30px] place-items-center border border-current">
            {icon}
          </span>
        )}
      </div>
      <strong className="mt-[18px] block text-[clamp(29px,3vw,44px)] leading-none font-bold tracking-[-0.05em] tabular-nums">
        {value}
      </strong>
      <p className="mt-[7px] max-w-[210px] font-mono text-[10px]/[1.4] opacity-70">{sub}</p>
    </article>
  );
}

const CONF_VARIANT: Record<string, "high" | "medium" | "low"> = {
  high: "high",
  medium: "medium",
  low: "low",
};

export function ConfidenceBadge({ level }: { level: string | null }) {
  return <Badge variant={level ? CONF_VARIANT[level] ?? "default" : "default"}>{level ?? "unknown"}</Badge>;
}

export function QualityStrip({
  cleanPct,
  countMatch,
  qtyMatch,
  caFactor,
}: {
  cleanPct: string;
  countMatch: boolean | null;
  qtyMatch: boolean | null;
  caFactor: number | null;
}) {
  const dot = (ok: boolean | null) => (
    <span
      className={cn(
        "inline-block h-[7px] w-[7px] rounded-full border border-ink",
        ok === true ? "bg-lime" : ok === false ? "bg-pink" : "bg-line"
      )}
    />
  );
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-muted">
      <span>
        CLEAN ROWS <strong className="text-ink">{cleanPct}</strong>
      </span>
      <span className="flex items-center gap-1.5">
        {dot(countMatch)} TRAILER COUNT
      </span>
      <span className="flex items-center gap-1.5">{dot(qtyMatch)} TRAILER QTY</span>
      <span>
        CA FACTOR <strong className="text-ink">×{caFactor ?? 1}</strong>
      </span>
    </div>
  );
}

export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-ink bg-panel">
      <table className="w-full min-w-[720px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-ink bg-[#e8e4d9] text-left font-mono text-[9px] font-extrabold tracking-[0.08em] text-muted uppercase">
            {head.map((h) => (
              <th key={h} className="px-3 py-[11px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dedacf] tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}

export function PageLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[#2849c5] hover:underline">
      {children}
    </Link>
  );
}
