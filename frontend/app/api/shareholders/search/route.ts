import { searchShareholders } from "@/lib/queries";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return Response.json({ error: "query too short (min 2 chars)" }, { status: 400 });
  }
  const rows = await searchShareholders(q, 50);
  return Response.json({ rows });
}
