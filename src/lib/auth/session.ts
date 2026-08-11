import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { MarketingStatus, OffshoreOffice, Role, UserStatus } from "@/generated/prisma/client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookieName";

export { SESSION_COOKIE_NAME };
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export type SessionUser = {
  id: string;
  role: Role;
  status: UserStatus;
  firstName: string;
  lastName: string;
  username: string;
  locationId: string | null;
  managerId: string | null;
  locationManagerId: string | null;
  coordinatorId: string | null;
  offshoreOffice: OffshoreOffice | null;
  offshoreTeamLeadId: string | null;
  trainerUserId: string | null;
  otterTeamUserId: string | null;
  marketingStatus: MarketingStatus;
};

function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a new session for the given user. For CONSULTANT accounts this
 * enforces the single-active-session rule by revoking every other active
 * session first, per the product spec.
 */
export async function createSession(
  userId: string,
  role: Role,
  meta: { ipAddress?: string | null; userAgent?: string | null }
): Promise<string> {
  if (role === "CONSULTANT") {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const rawToken = generateRawToken();
  await prisma.session.create({
    data: {
      userId,
      sessionTokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    },
  });

  return rawToken;
}

export async function setSessionCookie(rawToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (session.user.status !== "ACTIVE" || session.user.deletedAt) {
    return null;
  }

  return {
    id: session.user.id,
    role: session.user.role,
    status: session.user.status,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    username: session.user.username,
    locationId: session.user.locationId,
    managerId: session.user.managerId,
    locationManagerId: session.user.locationManagerId,
    coordinatorId: session.user.coordinatorId,
    offshoreOffice: session.user.offshoreOffice,
    offshoreTeamLeadId: session.user.offshoreTeamLeadId,
    trainerUserId: session.user.trainerUserId,
    otterTeamUserId: session.user.otterTeamUserId,
    marketingStatus: session.user.marketingStatus,
  };
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    await prisma.session.updateMany({
      where: { sessionTokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await clearSessionCookie();
}
