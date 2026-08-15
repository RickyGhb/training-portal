import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookieName";
import { buildCsp } from "@/lib/csp";

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
 *
 * Also generates a per-request CSP nonce here rather than in next.config.ts's
 * static headers() — a nonce has to be fresh per request, and this is the
 * only place in a Next.js app that runs before every render. Next.js reads
 * the nonce back out of the Content-Security-Policy response header it sees
 * here and applies it to its own inline bootstrap/hydration scripts
 * automatically; the app has no custom inline <script> tags of its own to
 * wire up. This replaces script-src 'unsafe-inline' (which would have let
 * ANY inline script run, including an attacker's, defeating CSP's purpose
 * as an XSS backstop) with 'strict-dynamic' + the nonce, the standard
 * Next.js CSP pattern. style-src keeps 'unsafe-inline' — nonces don't cover
 * the style="..." attribute (only <script>/<style> elements), and this app
 * has a handful of React style={{}} usages; that's a lower-severity gap
 * (CSS-only injection, not code execution) left as-is rather than a
 * broader refactor. The policy-string builder itself lives in
 * src/lib/csp.ts so it's unit-testable without pulling in next/server.
 */
export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "production");

  const { pathname } = request.nextUrl;
  // /f/* is the public form-fill surface (see src/app/f/[slug]) — deliberately
  // a distinct prefix from the internal /forms builder/submissions pages, so
  // this carve-out can never accidentally expose those.
  const isPublicPath = pathname === "/login" || pathname.startsWith("/api/") || pathname.startsWith("/f/");

  if (!isPublicPath) {
    const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
    if (!hasSessionCookie) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.headers.set("Content-Security-Policy", csp);
      return response;
    }
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. /login and
     * /api/* are now included (unlike before) so they get the CSP header
     * too — the auth-redirect logic above still skips them explicitly.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
