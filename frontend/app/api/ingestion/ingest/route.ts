import { randomUUID } from "node:crypto";
import { readJob, startJob } from "@/lib/jobs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    step?: string;
    ca?: string;
    emit?: string;
    force?: boolean;
  };
  const jobId = randomUUID().slice(0, 8);
  if (body.step === "builddb") {
    const args = ["build-db", "--output", "processed", "--wait", "120"];
    if (body.ca) args.push("--ca", body.ca, "--company-map", "company_map.csv");
    startJob(jobId, "build-db", args);
  } else {
    const args = [
      "process",
      "--input",
      "data",
      "--output",
      "processed",
      "--company-map",
      "company_map.csv",
      "--emit",
      body.emit === "csv" || body.emit === "both" ? body.emit : "parquet",
    ];
    if (body.force) args.push("--force");
    startJob(jobId, "process", args);
  }
  return Response.json({ jobId });
}

export async function GET(request: Request) {
  const job = new URL(request.url).searchParams.get("job") ?? "";
  if (!/^[0-9a-f-]{8}$/.test(job)) {
    return Response.json({ error: "unknown job" }, { status: 400 });
  }
  return Response.json(readJob(job));
}
