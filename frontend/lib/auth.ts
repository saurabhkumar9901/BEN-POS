import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "benpos_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getUsername(): string {
  return process.env.AUTH_USERNAME ?? "Admin";
}

function getPassword(): string {
  return process.env.AUTH_PASSWORD ?? "Admin@123";
}

function getSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    "benpos-dev-secret-change-me-in-production"
  );
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyCredentials(username: string, password: string): boolean {
  // Exact match only. Single allowed identity: Admin / Admin@123 (overridable via env).
  return safeEqual(username, getUsername()) && safeEqual(password, getPassword());
}

/** Build a signed session cookie value: base64("Admin|<expiresAtMs>|<sig>"). */
export function createSessionValue(): { value: string; expires: Date } {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const data = `${getUsername()}|${expiresAt}`;
  const value = Buffer.from(`${data}|${sign(data)}`, "utf8").toString("base64url");
  return { value, expires: new Date(expiresAt) };
}

/** Full verification (use on the server / in route handlers / layouts). */
export function verifySessionValue(raw: string | undefined | null): boolean {
  if (!raw) return false;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [username, expiresAt, sig] = decoded.split("|");
    if (!username || !expiresAt || !sig) return false;
    if (!safeEqual(username, getUsername())) return false;
    if (Number(expiresAt) < Date.now()) return false;
    return safeEqual(sig, sign(`${username}|${expiresAt}`));
  } catch {
    return false;
  }
}

/** Optimistic check for Proxy (edge-safe, no node:crypto): expiry + shape only. */
export function isSessionFreshOptimistic(raw: string | undefined | null): boolean {
  if (!raw) return false;
  try {
    // base64url decode without Buffer (edge-compatible)
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(b64);
    const parts = decoded.split("|");
    if (parts.length !== 3) return false;
    const expiresAt = Number(parts[1]);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  } catch {
    return false;
  }
}
