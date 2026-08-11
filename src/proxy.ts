import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookieName";

/**
 * Edge-level early auth check. This is a lightweight complement to, not a
 * replacement for, getCurrentUser()'s full DB-backed session validation
 * (revoked sessions, deactivated accounts, expiry) which still runs in
 * every protected layout/page — that's the actual security boundary, and
 * proxy can't safely replicate it (no DB access on the Edge runtime this
 * runs on). All this does is reject the "no session cookie at all" case —
 * bots, crawlers, logged-out direct hits — before a full server render + DB
 * round-trip happens, matching the audit's ask for cheap edge-level
 * filtering rather than doing nothing until the page itself checks.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except: /login, /api/*, Next internals, and static assets.
     * Root "/" is intentionally included — it does its own full DB-backed
     * redirect today, but there's no reason to let a cookie-less hit reach
     * even that render.
     */
    "/((?!login|api|_next/static|_next/image|favicon.ico).*)",
  ],
};
