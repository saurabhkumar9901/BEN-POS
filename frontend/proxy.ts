import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "benpos_session";
const PUBLIC_PATHS = ["/login"];

/** Optimistic check (edge-safe): cookie shape + expiry only, no signature verify. */
function isSessionFreshOptimistic(raw: string | undefined | null): boolean {
  if (!raw) return false;
  try {
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

/** Optimistic auth check: cookie shape + expiry only (no DB, per Next.js docs). */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isPublic) {
    // Authenticated users don't need the login page.
    const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (isSessionFreshOptimistic(session)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!isSessionFreshOptimistic(session)) {
    // API consumers get JSON, pages get a redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
