"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPasswordConstantTime } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter both a username and password." };
  }

  const { username, password } = parsed.data;
  const usernameLower = username.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { usernameLower } });

  const headerList = await headers();
  const ipAddress = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");

  // Generic error message regardless of which check fails, to avoid
  // leaking whether a username exists. The password comparison always runs
  // (against a dummy hash when there's no valid account) so response time
  // doesn't leak that information either.
  const genericError = "Invalid username or password.";
  const accountUsable = !!user && !user.deletedAt && user.status === "ACTIVE";

  const passwordValid = await verifyPasswordConstantTime(accountUsable ? user!.passwordHash : null, password);
  if (!accountUsable || !passwordValid) {
    await logFailedLogin(user?.id ?? null, usernameLower, ipAddress);
    return { error: genericError };
  }

  const rawToken = await createSession(user.id, user.role, { ipAddress, userAgent });
  await setSessionCookie(rawToken);

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actionType: "LOGIN_SUCCEEDED",
      targetEntityType: "User",
      targetEntityId: user.id,
      targetUserId: user.id,
      locationId: user.locationId,
      metadataJson: { ipAddress },
    },
  });

  redirect("/dashboard");
}

async function logFailedLogin(userId: string | null, usernameLower: string, ipAddress: string | null) {
  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      actionType: "LOGIN_FAILED",
      targetEntityType: "User",
      targetEntityId: userId,
      targetUserId: userId,
      metadataJson: { usernameLower, ipAddress },
    },
  });
}
