import { snapshotDates, topHolders } from "@/lib/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ isin: string }> }
) {
  const { isin } = await params;
  if (!/^INE[A-Z0-9]{9}$/.test(isin)) {
    return Response.json({ error: "invalid ISIN" }, { status: 400 });
  }
  const sp = new URL(request.url).searchParams;
  let date = sp.get("date") ?? undefined;
  if (!date) {
    const dates = await snapshotDates();
    date = dates[0];
  }
  if (!date) return Response.json({ error: "no snapshots" }, { status: 404 });
  const limit = Math.min(500, Number(sp.get("limit") ?? "50") || 50);
  const offset = Math.max(0, Number(sp.get("offset") ?? "0") || 0);
  const minQty = Math.max(0, Number(sp.get("minQty") ?? "0") || 0);
  const result = await topHolders(isin, date, limit, offset, {
    q: sp.get("q") ?? undefined,
    depo: sp.get("depo") ?? undefined,
    minQty,
    state: sp.get("state") ?? undefined,
  });
  return Response.json({ ...result, date, limit, offset });
}
