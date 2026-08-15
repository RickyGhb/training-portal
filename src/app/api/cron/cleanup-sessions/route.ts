import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REVOKED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // keep revoked-but-not-yet-expired rows a week for audit purposes

/**
 * Vercel Cron (see vercel.json) hits this daily. Session rows (with
 * ipAddress/userAgent PII) were otherwise never deleted — expiry was
 * enforced only at read time in getCurrentUser(), so the table grew
 * forever. Authenticated via the CRON_SECRET Vercel automatically sends as
 * a Bearer token when a cron job it triggers has that env var set
 * (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const revokedCutoff = new Date(now.getTime() - REVOKED_RETENTION_MS);

  const [expired, revoked] = await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.session.deleteMany({ where: { revokedAt: { lt: revokedCutoff } } }),
  ]);

  return NextResponse.json({ deletedExpired: expired.count, deletedRevoked: revoked.count });
}
