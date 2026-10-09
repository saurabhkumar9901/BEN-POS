import { spawn } from "node:child_process";
import fs from "node:fs";
import { bustCache } from "./cache";
import { bustViewCache } from "./views";
import path from "node:path";

// Project root = one level above frontend/. Pipeline runs there with
// PYTHONPATH=src so `python -m benpos` resolves.
export const PROJECT_ROOT = path.resolve(process.cwd(), "..");
export const DATA_DIR = path.join(PROJECT_ROOT, "data");
export const PROCESSED_DIR = path.join(PROJECT_ROOT, "processed");

export type JobState = "running" | "done" | "failed" | "needs_restart";

export function jobPaths(jobId: string) {
  return {
    log: path.join(PROCESSED_DIR, `_ingest_${jobId}.log`),
    status: path.join(PROCESSED_DIR, `_ingest_${jobId}.json`),
  };
}

export function safeName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-() ]/g, "_").trim();
  return base || "upload.txt";
}

function writeStatus(jobId: string, patch: Record<string, unknown>) {
  const { status } = jobPaths(jobId);
  let cur: Record<string, unknown> = {};
  try {
    cur = JSON.parse(fs.readFileSync(status, "utf8"));
  } catch {
    /* fresh */
  }
  fs.writeFileSync(status, JSON.stringify({ ...cur, ...patch }));
}

const LOCK_RE = /already open|being used by another process|could not obtain lock|lock timeout|conflict/i;
const MAX_ATTEMPTS = 6;
const RETRY_MS = 10_000;

export function startJob(
  jobId: string,
  step: string,
  args: string[],
  onText?: (line: string) => void
): void {
  const { log } = jobPaths(jobId);
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  fs.writeFileSync(log, `$ python -m benpos ${args.join(" ")}\n`);
  writeStatus(jobId, { jobId, step, state: "running", startedAt: new Date().toISOString() });
  attempt(jobId, step, args, onText, MAX_ATTEMPTS);
}

function attempt(
  jobId: string,
  step: string,
  args: string[],
  onText: ((line: string) => void) | undefined,
  left: number
): void {
  const { log } = jobPaths(jobId);
  const append = (d: Buffer | string) => {
    fs.appendFileSync(log, d);
    if (onText) onText(String(d));
  };
  const child = spawn("python", ["-m", "benpos", ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PYTHONPATH: "src" },
  });
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("error", (err) => {
    append(`\nSPAWN ERROR: ${err.message}\n`);
    writeStatus(jobId, { state: "failed", finishedAt: new Date().toISOString() });
  });
  child.on("close", (code) => {
    let tail = "";
    try {
      tail = fs.readFileSync(log, "utf8").slice(-3000);
    } catch {
      /* ignore */
    }
    if (code === 0) {
      if (step === "builddb") {
        bustCache();
        bustViewCache();
        append("\nQuery cache busted - fresh reads from here on.\n");
      }
      writeStatus(jobId, { state: "done", exitCode: code, finishedAt: new Date().toISOString() });
      return;
    }
    // Writer lost the race with a reader holding the file: back off and retry.
    if (left > 1 && LOCK_RE.test(tail)) {
      append(
        `\nDB locked by a reader — retrying in ${RETRY_MS / 1000}s (${left - 1} left)…\n`
      );
      setTimeout(() => attempt(jobId, step, args, onText, left - 1), RETRY_MS);
      return;
    }
    writeStatus(jobId, {
      state: LOCK_RE.test(tail) ? "needs_restart" : "failed",
      exitCode: code,
      finishedAt: new Date().toISOString(),
    });
  });
}

export function readJob(jobId: string): { status: Record<string, unknown>; tail: string } {
  const { log, status } = jobPaths(jobId);
  let st: Record<string, unknown> = { state: "running" };
  try {
    st = JSON.parse(fs.readFileSync(status, "utf8"));
  } catch {
    /* still starting */
  }
  let content = "";
  try {
    content = fs.readFileSync(log, "utf8");
  } catch {
    /* no output yet */
  }
  return { status: st, tail: content.slice(-6000) };
}

export function listDataFiles(): { benpos: { name: string; mb: number }[]; ca: string[] } {
  let names: string[] = [];
  try {
    names = fs.readdirSync(DATA_DIR);
  } catch {
    /* no data dir yet */
  }
  const benpos = names
    .filter((n) => n.toLowerCase().endsWith(".txt"))
    .map((n) => {
      let mb = 0;
      try {
        mb = fs.statSync(path.join(DATA_DIR, n)).size / 1048576;
      } catch {
        /* gone */
      }
      return { name: n, mb: Math.round(mb * 10) / 10 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const here = names.filter((n) => n.toLowerCase().endsWith(".csv"));
  let docs: string[] = [];
  try {
    docs = fs.readdirSync(path.join(PROJECT_ROOT, "docs")).filter((n) => n.toLowerCase().endsWith(".csv"));
  } catch {
    /* no docs dir */
  }
  return { benpos, ca: [...here.map((n) => `data/${n}`), ...docs.map((n) => `docs/${n}`)] };
}
