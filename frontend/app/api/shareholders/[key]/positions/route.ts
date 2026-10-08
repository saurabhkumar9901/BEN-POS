import { positionDetail } from "@/lib/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  if (!/^ik_[0-9a-f]{16}$/.test(key)) {
    return Response.json({ error: "invalid investor key" }, { status: 400 });
  }
  const sp = new URL(request.url).searchParams;
  const isin = sp.get("isin") ?? "";
  if (!/^INE[A-Z0-9]{9}$/.test(isin)) {
    return Response.json({ error: "isin required" }, { status: 400 });
  }
  const date = sp.get("date") ?? undefined;
  const rows = await positionDetail(key, isin, date);
  return Response.json({ rows });
}
