"use server";

import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";
import { canCreateRole } from "@/lib/auth/rbac";
import { UserFacingError } from "@/lib/errors";
import { requireActor } from "./actions";

/**
 * Finds an unused username starting from `prefix`. With no `startAt`, tries the bare prefix
 * first and only appends 2/3/... on a real collision. With `startAt`, always appends a number
 * (used by the Consultant suggestion's legacy 120+ numbering convention).
 */
async function findAvailableUsername(prefix: string, startAt?: number): Promise<string> {
  const existing = await prisma.user.findMany({
    where: { usernameLower: { startsWith: prefix.toLowerCase() } },
    select: { usernameLower: true },
  });
  const taken = new Set(existing.map((u) => u.usernameLower));

  if (startAt === undefined) {
    if (!taken.has(prefix.toLowerCase())) return prefix;
    let n = 2;
    while (taken.has(`${prefix}${n}`.toLowerCase())) n++;
    return `${prefix}${n}`;
  }

  let n = startAt;
  let candidate = `${prefix}${n}`;
  while (taken.has(candidate.toLowerCase())) {
    n++;
    candidate = `${prefix}${n}`;
  }
  return candidate;
}

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
  const consultantsSoFar = await prisma.user.count({ where: { role: "CONSULTANT" } });
  return findAvailableUsername(prefix, 120 + consultantsSoFar);
}

/**
 * Live username suggestion for every non-Consultant creatable role: {FirstName}.{LastInitial},
 * e.g. "John.D", incrementing to "John.D2" only on a real collision. Trainer is the one
 * exception — it has its own technology field, so it uses the Consultant-style
 * {FirstName}.{techAbbrev} pattern instead when a technology abbreviation is supplied.
 */
export async function suggestStaffUsernameAction(
  role: Role,
  firstName: string,
  lastName: string,
  techAbbrev?: string
): Promise<string> {
  const actor = await requireActor();
  if (role === "CONSULTANT" || !canCreateRole(actor.role, role)) {
    throw new UserFacingError("Not permitted.");
  }

  const first = firstName.trim().replace(/\s+/g, "");
  if (!first) return "";

  if (role === "TRAINER" && techAbbrev?.trim()) {
    return findAvailableUsername(`${first}.${techAbbrev.trim()}`);
  }

  const lastInitial = lastName.trim().charAt(0);
  if (!lastInitial) return "";
  return findAvailableUsername(`${first}.${lastInitial}`);
}
