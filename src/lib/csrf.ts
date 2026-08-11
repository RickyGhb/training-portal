import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Synchronizer-token-pattern CSRF defense for the one plain-GET route that
 * has no built-in protection (Next.js Server Actions get CSRF protection
 * automatically; a plain `<form method="GET">` posting to a Route Handler
 * does not). Derived deterministically from the session's own httpOnly
 * cookie value rather than a separately stored secret — an attacker's
 * cross-origin page can force the victim's browser to *send* the session
 * cookie, but same-origin policy still stops it from *reading* the export
 * page's HTML to learn the resulting token, which is what actually blocks
 * the forged request.
 */
export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const rawSessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawSessionToken) return null;
  return createHash("sha256").update(`csrf:${rawSessionToken}`).digest("hex");
}

export async function verifyCsrfToken(candidate: string | null): Promise<boolean> {
  if (!candidate) return false;
  const expected = await getCsrfToken();
  if (!expected) return false;
  const expectedBuf = Buffer.from(expected);
  const candidateBuf = Buffer.from(candidate);
  if (expectedBuf.length !== candidateBuf.length) return false;
  return timingSafeEqual(expectedBuf, candidateBuf);
}
