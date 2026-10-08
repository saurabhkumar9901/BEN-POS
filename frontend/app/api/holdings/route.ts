import { holdingsExplorer } from "@/lib/queries";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const get = (k: string) => sp.get(k) ?? undefined;
  const page = Math.max(1, Number(get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(get("pageSize") ?? "50") || 50));
  const minQty = Math.max(0, Number(get("minQty") ?? "0") || 0);
  const result = await holdingsExplorer({
    isin: get("isin") || undefined,
    depo: get("depo") || undefined,
    state: get("state") || undefined,
    minQty,
    sort: get("sort") || undefined,
    dir: get("dir") || undefined,
    page,
    pageSize,
  });
  return Response.json({ ...result, page, pageSize });
}
