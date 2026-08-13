"use server";

import { prisma } from "@/lib/prisma";
import { canCreateRole } from "@/lib/auth/rbac";
import { UserFacingError } from "@/lib/errors";
import { requireActor } from "./actions";

/**
 * Live username suggestion for the Consultant-creation form: {FirstName}.{techAbbrev}{number},
 * where number is a single global counter (120 + consultants created so far), auto-incrementing
 * past any residual collision.
 */
export async function suggestConsultantUsernameAction(firstName: string, techAbbrev: string): Promise<string> {
  const actor = await requireActor();
  if (!canCreateRole(actor.role, "CONSULTANT")) {
    throw new UserFacingError("Not permitted.");
  }

  const first = firstName.trim().replace(/\s+/g, "");
  const abbrev = techAbbrev.trim();
  if (!first || !abbrev) return "";

  const prefix = `${first}.${abbrev}`;
  const [consultantsSoFar, existing] = await Promise.all([
    prisma.user.count({ where: { role: "CONSULTANT" } }),
    prisma.user.findMany({
      where: { usernameLower: { startsWith: prefix.toLowerCase() } },
      select: { usernameLower: true },
    }),
  ]);
  const taken = new Set(existing.map((u) => u.usernameLower));

  let n = 120 + consultantsSoFar;
  let candidate = `${prefix}${n}`;
  while (taken.has(candidate.toLowerCase())) {
    n++;
    candidate = `${prefix}${n}`;
  }

  return candidate;
}
