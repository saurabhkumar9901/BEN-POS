import { leaders } from "@/lib/queries";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const minCompanies = Math.max(1, Number(sp.get("minCompanies") ?? "2") || 2);
  const limit = Math.min(500, Number(sp.get("limit") ?? "100") || 100);
  const rows = await leaders(minCompanies, limit);
  return Response.json({ rows, minCompanies, limit });
}
