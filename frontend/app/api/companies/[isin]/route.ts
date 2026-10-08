import { caFactor, companyQuality, companyStats } from "@/lib/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ isin: string }> }
) {
  const { isin } = await params;
  if (!/^INE[A-Z0-9]{9}$/.test(isin)) {
    return Response.json({ error: "invalid ISIN" }, { status: 400 });
  }
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  const stats = await companyStats(isin, date);
  if (!stats) return Response.json({ error: "not found" }, { status: 404 });
  const [quality, factor] = await Promise.all([
    companyQuality(isin, date),
    caFactor(isin, date),
  ]);
  return Response.json({ stats, quality, ca_factor: factor });
}
