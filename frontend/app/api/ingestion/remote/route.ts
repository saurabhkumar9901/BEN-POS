const API = "https://api.github.com";

function cfg() {
  const token = process.env.GH_TOKEN;
  const repo = process.env.GH_REPO ?? "saurabhkumar9901/BEN-POS";
  const workflow = process.env.GH_WORKFLOW ?? "ingest.yml";
  if (!token) return null;
  return { token, repo, workflow };
}

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Dispatch the ingest workflow. Body: { keys: [...], ca_key?: str } */
export async function POST(request: Request) {
  const c = cfg();
  if (!c) {
    return Response.json({ error: "GH_TOKEN not configured" }, { status: 500 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    keys?: string[];
    ca_key?: string;
  };
  const keys = (body.keys ?? []).filter((k) => typeof k === "string");
  if (!keys.length) {
    return Response.json({ error: "keys[] required" }, { status: 400 });
  }
  const r = await fetch(
    `${API}/repos/${c.repo}/actions/workflows/${c.workflow}/dispatches`,
    {
      method: "POST",
      headers: headers(c.token),
      body: JSON.stringify({ ref: "main", inputs: { keys: keys.join("\n"), ca_key: body.ca_key ?? "" } }),
    }
  );
  if (!r.ok) {
    return Response.json({ error: `dispatch failed: ${r.status}` }, { status: 502 });
  }
  // Find the run we just created (most recent in_progress run of the workflow).
  await new Promise((res) => setTimeout(res, 4000));
  const runs = await fetch(
    `${API}/repos/${c.repo}/actions/workflows/${c.workflow}/runs?per_page=3`,
    { headers: headers(c.token) }
  ).then((x) => x.json());
  const run = runs?.workflow_runs?.[0];
  if (!run?.id) {
    return Response.json({ error: "dispatched, but run not visible yet - retry" }, { status: 502 });
  }
  return Response.json({ jobId: String(run.id) });
}

function mapState(run: Record<string, unknown>): string {
  const status = run.status as string;
  const conclusion = run.conclusion as string | null;
  if (status === "completed") return conclusion === "success" ? "done" : "failed";
  return "running";
}

/** Poll a dispatched run. GET ?job=<run_id> */
export async function GET(request: Request) {
  const c = cfg();
  if (!c) {
    return Response.json({ error: "GH_TOKEN not configured" }, { status: 500 });
  }
  const id = new URL(request.url).searchParams.get("job") ?? "";
  if (!/^\d{1,20}$/.test(id)) {
    return Response.json({ error: "unknown job" }, { status: 400 });
  }
  const r = await fetch(`${API}/repos/${c.repo}/actions/runs/${id}`, {
    headers: headers(c.token),
  });
  if (!r.ok) {
    return Response.json({ error: `run lookup failed: ${r.status}` }, { status: 502 });
  }
  const run = (await r.json()) as Record<string, unknown>;
  const state = mapState(run);
  // Normalize to the local console shape { jobId, status, tail }.
  return Response.json({
    jobId: id,
    status: { state, step: "remote ingest", jobId: id },
    tail:
      state === "done"
        ? `Done. See run ${run.html_url as string}`
        : state === "failed"
          ? `Failed: ${run.html_url as string} - check the Actions logs`
          : `Phase: ${(run.status as string) ?? "?"} - ${run.html_url as string}`,
  });
}
