const INT_FMT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const PCT_FMT = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function fmtInt(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return INT_FMT.format(n);
}

export function fmtPct(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return `${PCT_FMT.format(n)}%`;
}

export function fmtDate(v: string | null | undefined): string {
  return v ?? "—";
}

/** Indian compact: 116.4Cr (crore), 3.1L (lakh), 54.3K. */
export function fmtCompact(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  const trim = (x: number) => (Number.isInteger(Math.round(x * 10) / 10) ? String(Math.round(x)) : x.toFixed(1));
  if (a >= 1e7) return `${sign}${trim(a / 1e7)}Cr`;
  if (a >= 1e5) return `${sign}${trim(a / 1e5)}L`;
  if (a >= 1e3) return `${sign}${trim(a / 1e3)}K`;
  return `${sign}${a}`;
}

/** 17 Jul 2026 from ISO. */
export function fmtAsOf(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}
