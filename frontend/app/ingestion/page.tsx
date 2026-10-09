"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui";

const BACKEND = process.env.NEXT_PUBLIC_INGEST_BACKEND === "render" ? "render" : "local";

type Files = { benpos: { name: string; mb: number }[]; ca: string[] };
type Job = { state: string; step?: string; exitCode?: number };

const STATE_TONE: Record<string, string> = {
  running: "bg-blue text-white",
  done: "bg-lime text-ink",
  failed: "bg-pink text-ink",
  needs_restart: "bg-orange text-ink",
};

export default function IngestionPage() {
  const [files, setFiles] = useState<Files>({ benpos: [], ca: [] });
  const [ca, setCa] = useState("");
  const [force, setForce] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [remoteKeys, setRemoteKeys] = useState<string[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  const refreshFiles = useCallback(async () => {
    if (BACKEND !== "local") return;
    const r = await fetch("/api/ingestion/files");
    if (r.ok) setFiles(await r.json());
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  // ---- local backend: spawn + poll local job files ----
  useEffect(() => {
    if (!jobId || BACKEND !== "local") return;
    let stop = false;
    const poll = async () => {
      const r = await fetch(`/api/ingestion/ingest?job=${jobId}`);
      if (!r.ok || stop) return;
      const data = await r.json();
      setJob(data.status);
      setLog(data.tail ?? "");
      if (data.status?.state === "running") {
        setTimeout(poll, 2000);
      } else {
        setBusy(false);
        refreshFiles();
      }
    };
    poll();
    return () => {
      stop = true;
    };
  }, [jobId, refreshFiles]);

  // ---- render backend: poll the worker via proxy ----
  useEffect(() => {
    if (!jobId || BACKEND !== "render") return;
    let stop = false;
    const poll = async () => {
      const r = await fetch(`/api/ingestion/remote?job=${jobId}`, { cache: "no-store" });
      if (!r.ok || stop) return;
      const data = await r.json();
      setJob(data.status);
      setLog((prev) => (prev.endsWith(data.tail) ? prev : `${prev}\n${data.tail}`));
      if (data.status?.state === "running") {
        setTimeout(poll, 5000);
      } else {
        setBusy(false);
      }
    };
    poll();
    return () => {
      stop = true;
    };
  }, [jobId]);

  async function uploadLocal(kind: "benpos" | "ca", input: HTMLInputElement | null) {
    const picked = input?.files;
    if (!picked || !picked.length) return;
    setBusy(true);
    const form = new FormData();
    form.set("kind", kind);
    for (const f of picked) form.append("files", f);
    const r = await fetch("/api/ingestion/files", { method: "POST", body: form });
    setBusy(false);
    if (r.ok) {
      const data = await r.json();
      setFiles(data.files);
    }
    if (input) input.value = "";
  }

  async function uploadR2(input: HTMLInputElement | null) {
    const picked = input?.files;
    if (!picked || !picked.length) return;
    setBusy(true);
    try {
      // Supabase free caps objects at 50 MB: gzip on the wire (<name>.gz),
      // worker gunzips after download. Local path stays raw (no cap there).
      const gzOf = async (f: File): Promise<Blob> => {
        const stream = f.stream().pipeThrough(new CompressionStream("gzip"));
        return await new Response(stream).blob();
      };
      const r = await fetch("/api/ingestion/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: Array.from(picked).map((f) => `${f.name}.gz`) }),
      });
      if (!r.ok) throw new Error("presign failed");
      const { uploads } = await r.json();
      const keys: string[] = [];
      await Promise.all(
        uploads.map(async (u: { name: string; key: string; url: string }, i: number) => {
          const put = await fetch(u.url, {
            method: "PUT",
            headers: { "Content-Type": "application/gzip" },
            body: await gzOf(picked[i]),
          });
          if (!put.ok) throw new Error(`upload failed: ${u.name}`);
          keys.push(u.key);
        })
      );
      setRemoteKeys((prev) => [...prev, ...keys]);
      setLog((prev) => `${prev}\nUploaded to R2:\n${keys.join("\n")}`);
    } catch (e) {
      setLog((prev) => `${prev}\nUpload error: ${(e as Error).message}`);
    }
    setBusy(false);
    if (input) input.value = "";
  }

  async function run(step: "process" | "builddb") {
    setBusy(true);
    setLog("");
    setJob({ state: "running", step });
    const r = await fetch("/api/ingestion/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, ca: ca || undefined, force, emit: "parquet" }),
    });
    if (!r.ok) {
      setBusy(false);
      setLog("Failed to start job.");
      return;
    }
    setJobId((await r.json()).jobId);
  }

  async function runRemote() {
    const isTxt = (k: string) => /\.txt(\.gz)?$/i.test(k);
    const isCsv = (k: string) => /\.csv(\.gz)?$/i.test(k);
    const txt = remoteKeys.filter(isTxt);
    const csv = remoteKeys.filter(isCsv);
    if (!txt.length) {
      setLog((prev) => `${prev}\nUpload at least one BENPOS .txt first.`);
      return;
    }
    setBusy(true);
    setLog("Dispatching ingest worker…");
    setJob({ state: "running", step: "remote ingest" });
    const r = await fetch("/api/ingestion/remote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: txt, ca_key: csv[0] }),
    });
    if (!r.ok) {
      const detail = await r.text();
      setBusy(false);
      setLog((prev) => `${prev}\nDispatch failed: ${detail}`);
      return;
    }
    setJobId((await r.json()).jobId);
  }

  return (
    <div className="space-y-4 pt-6">
      <SectionHeading
        number="00"
        kicker="INGESTION"
        title="Feed the desk."
        right={
          <Badge variant="ink">{BACKEND === "render" ? "RENDER WORKER" : "LOCAL ONLY"}</Badge>
        }
      />

      {BACKEND === "local" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>01 · BENPOS drops</CardTitle>
                <span className="font-mono text-[9px] text-muted">NSDL + CDSL .txt → data/</span>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  accept=".txt"
                  multiple
                  onChange={(e) => uploadLocal("benpos", e.target)}
                  disabled={busy}
                />
                <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px]">
                  {files.benpos.map((f) => (
                    <li key={f.name} className="flex justify-between border-b border-line py-1">
                      <span className="truncate">{f.name}</span>
                      <span className="text-muted">{f.mb} MB</span>
                    </li>
                  ))}
                  {files.benpos.length === 0 && <li className="text-muted">No .txt files yet.</li>}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>02 · Corporate actions</CardTitle>
                <span className="font-mono text-[9px] text-muted">BSE-format .csv</span>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={(e) => uploadLocal("ca", e.target)}
                  disabled={busy}
                />
                <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px]">
                  {files.ca.map((n) => (
                    <li key={n} className="border-b border-line py-1" title={n}>
                      {n.split("/").pop()}
                    </li>
                  ))}
                  {files.ca.length === 0 && <li className="text-muted">No CA csv yet.</li>}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>03 · Build</CardTitle>
              <span className="font-mono text-[9px] text-muted">
                process → parquet · build-db → duckdb views
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={ca} onChange={(e) => setCa(e.target.value)} className="min-w-[220px]">
                  <option value="">No CA file</option>
                  {files.ca.map((n) => (
                    <option key={n} value={n}>
                      {n.split("/").pop()}
                    </option>
                  ))}
                </Select>
                <label className="flex cursor-pointer items-center gap-2 border border-ink bg-panel px-3 py-[7px] font-mono text-[10px] font-bold">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#11120f]"
                  />
                  FORCE REPROCESS
                </label>
                <Button onClick={() => run("process")} disabled={busy}>
                  {busy ? "Working…" : "Process files"}
                </Button>
                <Button onClick={() => run("builddb")} disabled={busy} variant="dark">
                  {busy ? "Working…" : "Rebuild DB"}
                </Button>
              </div>
              <p className="font-mono text-[9px]/[1.5] text-muted">
                REBUILD DB takes the write lock automatically — readers never hold
                the file, and on a rare collision the job backs off and retries on
                its own.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>01 · Upload drops to R2</CardTitle>
                <span className="font-mono text-[9px] text-muted">
                  NSDL + CDSL .txt and CA .csv
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  accept=".txt,.csv"
                  multiple
                  onChange={(e) => uploadR2(e.target)}
                  disabled={busy}
                />
                <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px]">
                  {remoteKeys.map((k) => (
                    <li key={k} className="border-b border-line py-1" title={k}>
                      {k.split("/").pop()}
                    </li>
                  ))}
                  {remoteKeys.length === 0 && (
                    <li className="text-muted">Nothing staged yet.</li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>02 · Ingest on Render</CardTitle>
                <span className="font-mono text-[9px] text-muted">
                  process → build-db → MotherDuck sync
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-mono text-[10px]/[1.5] text-muted">
                  The worker downloads from R2, runs the full pipeline, and syncs
                  to MotherDuck. The desk reads fresh data after the cache TTL.
                </p>
                <Button onClick={runRemote} disabled={busy}>
                  {busy ? "Working…" : "Ingest now"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job console</CardTitle>
          {job && (
            <span
              className={`border border-ink px-2 py-1 font-mono text-[10px] font-extrabold uppercase ${STATE_TONE[job.state] ?? "bg-panel"}`}
            >
              {job.step ?? ""} · {job.state}
              {job.exitCode !== undefined ? ` (${job.exitCode})` : ""}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <pre
            ref={logRef}
            className="max-h-80 overflow-y-auto border border-ink bg-ink p-3 font-mono text-[11px]/[1.5] whitespace-pre-wrap text-[#d6d8d0]"
          >
            {log ||
              (BACKEND === "render"
                ? "No job yet. Upload drops to R2, then Ingest now."
                : "No job yet. Upload files, then Process / Rebuild DB.")}
          </pre>
          {job?.state === "needs_restart" && (
            <p className="mt-2 border border-ink bg-orange p-2 font-mono text-[10px] font-bold">
              DB STAYED LOCKED AFTER RETRIES — CLOSE ANY OTHER PROGRAM HOLDING
              benpos.duckdb, THEN CLICK REBUILD DB AGAIN.
            </p>
          )}
          {BACKEND === "local" && (
            <p className="mt-2 font-mono text-[10px] text-muted">
              {fmtInt(files.benpos.length)} BENPOS files · {fmtInt(files.ca.length)} CA files on
              disk.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
