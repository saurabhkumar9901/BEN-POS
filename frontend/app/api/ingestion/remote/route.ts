function base(): string | null {
  const url = (process.env.RENDER_INGEST_URL ?? "").replace(/\/$/, "");
  return url || null;
}

export async function POST(request: Request) {
  const upstream = base();
  if (!upstream) {
    return Response.json({ error: "RENDER_INGEST_URL not configured" }, { status: 500 });
  }
  const body = await request.json().catch(() => ({}));
  const r = await fetch(`${upstream}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return Response.json(await r.json(), { status: r.status });
}

export async function GET(request: Request) {
  const upstream = base();
  if (!upstream) {
    return Response.json({ error: "RENDER_INGEST_URL not configured" }, { status: 500 });
  }
  const id = new URL(request.url).searchParams.get("job") ?? "";
  if (!/^[\w-]{1,64}$/.test(id)) {
    return Response.json({ error: "unknown job" }, { status: 400 });
  }
  const r = await fetch(`${upstream}/jobs/${encodeURIComponent(id)}`);
  const data = await r.json();
  // Normalize Render job shape to the local console shape.
  return Response.json({
    jobId: id,
    status: { state: data.state, step: data.phase, jobId: id },
    tail: data.state === "done"
      ? `Done. Tables: ${JSON.stringify(data.counts ?? {})}`
      : data.state === "failed"
        ? (data.error ?? "failed")
        : `Phase: ${data.phase ?? "?"} — files: ${(data.files ?? []).join(", ")}`,
  });
}
