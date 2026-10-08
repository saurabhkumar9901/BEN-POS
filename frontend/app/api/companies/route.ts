import { listCompanies } from "@/lib/queries";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const page = Number(sp.get("page") ?? "1") || 1;
  const pageSize = Number(sp.get("pageSize") ?? "50") || 50;
  const result = await listCompanies({
    q: sp.get("q") ?? undefined,
    date: sp.get("date") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    dir: sp.get("dir") ?? undefined,
    page,
    pageSize,
  });
  return Response.json({ ...result, page, pageSize });
}
