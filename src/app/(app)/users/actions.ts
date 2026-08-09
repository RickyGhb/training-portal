"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, clearSessionCookie, type SessionUser } from "@/lib/auth/session";
import {
  canCreateRole,
  canManageUser,
  canBulkReassign,
  locationAssignmentModeFor,
  type ScopeSubject,
} from "@/lib/auth/rbac";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import {
  createStaffUserSchema,
  createConsultantSchema,
  usernameSchema,
  updateProfileFieldsSchema,
  profileChangeRequestSchema,
} from "@/lib/validation/user";
import { logAudit, notifyCeos, notifyUser } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";

export type FormState = { error?: string; success?: string };

async function requireActor(): Promise<SessionUser> {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Not authenticated");
  return actor;
}

async function assertUsernameAvailable(username: string) {
  const existing = await prisma.user.findUnique({ where: { usernameLower: username.toLowerCase() } });
  if (existing) throw new UserFacingError("That username is already taken.");
}

/** Catch-block helper: only ever surface messages we deliberately wrote for the user (UserFacingError). Anything else (Prisma errors, unexpected exceptions) would leak internal details. */
function toFormError(err: unknown): { error: string } {
  return { error: err instanceof UserFacingError ? err.message : "Something went wrong. Please try again." };
}

/** Creates a LOCATION_MANAGER, LOCATION_ADMIN, or COORDINATOR account. */
export async function createStaffUserAction(role: Role, _prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();

  if (!canCreateRole(actor.role, role)) {
    return { error: "You don't have permission to create this type of account." };
  }

  const parsed = createStaffUserSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    username: formData.get("username"),
    password: formData.get("password"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    locationId: formData.get("locationId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { firstName, lastName, username, password, email, phone, locationId } = parsed.data;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) return { error: strength.reason };

  // Location scoping rules per role.
  let finalLocationId: string | null = null;
  const mode = locationAssignmentModeFor(actor.role, role);

  if (mode === "required") {
    if (!locationId) return { error: "A location is required for this account type." };
    finalLocationId = locationId;
  } else if (mode === "optional") {
    finalLocationId = locationId ?? null;
  } else if (mode === "inherit") {
    if (!actor.locationId) {
      return { error: "Your account isn't assigned to a location yet, so you can't create users. Ask a CEO to assign one." };
    }
    finalLocationId = actor.locationId;
  }

  // Supervisor chain: who is this new user's Location Manager / Location Admin?
  let finalManagerId: string | null = null;
  let finalLocationManagerId: string | null = null;

  if (actor.role === "LOCATION_MANAGER") {
    finalManagerId = actor.id;
  } else if (actor.role === "LOCATION_ADMIN") {
    finalLocationManagerId = actor.id;
    finalManagerId = actor.managerId;
  }

  try {
    await assertUsernameAvailable(username);

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        role,
        firstName,
        lastName,
        username,
        usernameLower: username.toLowerCase(),
        passwordHash,
        email,
        phone,
        locationId: finalLocationId,
        managerId: finalManagerId,
        locationManagerId: finalLocationManagerId,
        createdByUserId: actor.id,
      },
    });

    await logAudit({
      actorUserId: actor.id,
      actionType: "USER_CREATED",
      targetEntityType: "User",
      targetEntityId: user.id,
      targetUserId: user.id,
      locationId: user.locationId,
      metadata: { role },
    });

    revalidatePath("/users");
    return { success: `${firstName} ${lastName} created.` };
  } catch (err) {
    return toFormError(err);
  }
}

/** Creates a CONSULTANT account, owned by a coordinator within the actor's scope. */
export async function createConsultantAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();

  if (!canCreateRole(actor.role, "CONSULTANT")) {
    return { error: "You don't have permission to create consultants." };
  }

  const parsed = createConsultantSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    username: formData.get("username"),
    password: formData.get("password"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    coordinatorId: formData.get("coordinatorId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { firstName, lastName, username, password, email, phone, coordinatorId } = parsed.data;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) return { error: strength.reason };

  const coordinatorId_ = actor.role === "COORDINATOR" ? actor.id : coordinatorId;

  const coordinator = await prisma.user.findUnique({ where: { id: coordinatorId_ } });
  if (!coordinator || coordinator.role !== "COORDINATOR" || coordinator.status !== "ACTIVE") {
    return { error: "Chosen coordinator is not valid." };
  }
  if (!canManageUser(actor, coordinator as ScopeSubject)) {
    return { error: "That coordinator is outside your scope." };
  }

  try {
    await assertUsernameAvailable(username);

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        role: "CONSULTANT",
        firstName,
        lastName,
        username,
        usernameLower: username.toLowerCase(),
        passwordHash,
        email,
        phone,
        locationId: coordinator.locationId,
        coordinatorId: coordinator.id,
        createdByUserId: actor.id,
      },
    });

    await logAudit({
      actorUserId: actor.id,
      actionType: "USER_CREATED",
      targetEntityType: "User",
      targetEntityId: user.id,
      targetUserId: user.id,
      locationId: user.locationId,
      metadata: { role: "CONSULTANT", coordinatorId: coordinator.id },
    });

    revalidatePath("/users/consultants");
    return { success: `${firstName} ${lastName} created.` };
  } catch (err) {
    return toFormError(err);
  }
}

export async function updateUsernameAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  const userId = String(formData.get("userId"));
  const newUsernameRaw = formData.get("newUsername");

  const parsedUsername = usernameSchema.safeParse(newUsernameRaw);
  if (!parsedUsername.success) {
    return { error: parsedUsername.error.issues[0]?.message ?? "Invalid username." };
  }
  const newUsername = parsedUsername.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return { error: "User not found." };
  if (!canManageUser(actor, target as ScopeSubject)) return { error: "Not authorized." };

  try {
    await assertUsernameAvailable(newUsername);
    const oldUsername = target.username;

    await prisma.user.update({
      where: { id: userId },
      data: { username: newUsername, usernameLower: newUsername.toLowerCase() },
    });

    await logAudit({
      actorUserId: actor.id,
      actionType: "USERNAME_CHANGED",
      targetEntityType: "User",
      targetEntityId: userId,
      targetUserId: userId,
      locationId: target.locationId,
      metadata: { oldUsername, newUsername },
    });

    revalidatePath("/users");
    return { success: "Username updated." };
  } catch (err) {
    return toFormError(err);
  }
}

export async function resetPasswordAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  const userId = String(formData.get("userId"));
  const newPassword = String(formData.get("newPassword"));

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) return { error: strength.reason };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return { error: "User not found." };
  if (!canManageUser(actor, target as ScopeSubject)) return { error: "Not authorized." };

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Revoke existing sessions so the old password/session can't keep being used.
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const entry = await logAudit({
    actorUserId: actor.id,
    actionType: "PASSWORD_RESET",
    targetEntityType: "User",
    targetEntityId: userId,
    targetUserId: userId,
    locationId: target.locationId,
    metadata: { targetUsername: target.username },
  });

  await notifyCeos({
    type: "PASSWORD_RESET",
    title: "Password reset",
    body: `${actor.firstName} ${actor.lastName} reset the password for ${target.firstName} ${target.lastName} (${target.username}).`,
    sourceAuditLogId: entry.id,
  });

  revalidatePath("/users");
  return { success: "Password reset." };
}

export async function setUserStatusAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const userId = String(formData.get("userId"));
  const nextStatus = String(formData.get("nextStatus")) as "ACTIVE" | "DEACTIVATED";

  if (userId === actor.id) return; // can't deactivate your own account

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return;
  if (!canManageUser(actor, target as ScopeSubject)) return;

  await prisma.user.update({ where: { id: userId }, data: { status: nextStatus } });

  if (nextStatus === "DEACTIVATED") {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await logAudit({
    actorUserId: actor.id,
    actionType: nextStatus === "DEACTIVATED" ? "USER_DEACTIVATED" : "USER_REACTIVATED",
    targetEntityType: "User",
    targetEntityId: userId,
    targetUserId: userId,
    locationId: target.locationId,
  });

  revalidatePath("/users");
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const userId = String(formData.get("userId"));

  if (userId === actor.id) return; // can't delete your own account

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return;
  if (!canManageUser(actor, target as ScopeSubject)) return;

  await prisma.user.update({
    where: { id: userId },
    data: { status: "DELETED", deletedAt: new Date() },
  });

  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const entry = await logAudit({
    actorUserId: actor.id,
    actionType: "USER_DELETED",
    targetEntityType: "User",
    targetEntityId: userId,
    targetUserId: userId,
    locationId: target.locationId,
    metadata: { role: target.role, username: target.username },
  });

  if (target.role === "CONSULTANT") {
    await notifyCeos({
      type: "USER_DELETED",
      title: "Consultant deleted",
      body: `${actor.firstName} ${actor.lastName} deleted consultant ${target.firstName} ${target.lastName} (${target.username}).`,
      sourceAuditLogId: entry.id,
    });
  }

  revalidatePath("/users");
}

/** Self-service password change: the actor changes their own password, verifying the current one first. */
export async function changeOwnPasswordAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  const currentPassword = String(formData.get("currentPassword"));
  const newPassword = String(formData.get("newPassword"));

  const self = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!self || self.deletedAt) return { error: "Account not found." };

  const currentValid = await verifyPassword(self.passwordHash, currentPassword);
  if (!currentValid) return { error: "Current password is incorrect." };

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) return { error: strength.reason };

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash } });

  // Sign out everywhere, including this session — re-authenticate with the new password.
  await prisma.session.updateMany({
    where: { userId: actor.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await clearSessionCookie();

  await logAudit({
    actorUserId: actor.id,
    actionType: "PASSWORD_RESET",
    targetEntityType: "User",
    targetEntityId: actor.id,
    targetUserId: actor.id,
    locationId: self.locationId,
    metadata: { selfService: true },
  });

  redirect("/login");
}

/**
 * Updates name/email/phone for a user. Shared by self-edit (Coordinator and
 * above) and by a Coordinator manually applying a Consultant's change
 * request. Username has its own action (updateUsernameAction) and isn't
 * folded in here.
 */
export async function updateProfileFieldsAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  const userId = String(formData.get("userId"));

  const parsed = updateProfileFieldsSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return { error: "User not found." };

  const isSelf = actor.id === userId;
  if (isSelf) {
    if (actor.role === "CONSULTANT") {
      return { error: "Consultants can't edit their profile directly. Submit a change request instead." };
    }
  } else if (!canManageUser(actor, target as ScopeSubject)) {
    return { error: "Not authorized." };
  }

  const { firstName, lastName, email, phone } = parsed.data;

  await prisma.user.update({
    where: { id: userId },
    data: { firstName, lastName, email: email ?? null, phone: phone ?? null },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "PROFILE_UPDATED",
    targetEntityType: "User",
    targetEntityId: userId,
    targetUserId: userId,
    locationId: target.locationId,
    metadata: { selfService: isSelf, firstName, lastName, email: email ?? null, phone: phone ?? null },
  });

  revalidatePath("/profile");
  revalidatePath("/users");
  return { success: "Profile updated." };
}

const PROFILE_FIELD_LABELS: Record<string, string> = {
  firstName: "first name",
  lastName: "last name",
  email: "email",
  phone: "phone",
  username: "username",
};

/** Consultant-only: submits a profile-change request to their coordinator instead of editing directly. */
export async function profileChangeRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (actor.role !== "CONSULTANT") return { error: "Not authorized." };

  const parsed = profileChangeRequestSchema.safeParse({
    field: formData.get("field"),
    desiredValue: formData.get("desiredValue"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const self = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!self || self.deletedAt) return { error: "Account not found." };
  if (!self.coordinatorId) {
    return { error: "You don't have a coordinator assigned to review requests. Contact your admin." };
  }

  const { field, desiredValue, note } = parsed.data;

  const entry = await logAudit({
    actorUserId: actor.id,
    actionType: "PROFILE_CHANGE_REQUESTED",
    targetEntityType: "User",
    targetEntityId: actor.id,
    targetUserId: actor.id,
    locationId: self.locationId,
    metadata: { field, desiredValue, note: note ?? null },
  });

  await notifyUser({
    recipientUserId: self.coordinatorId,
    type: "PROFILE_CHANGE_REQUESTED",
    title: "Profile change request",
    body: `${self.firstName} ${self.lastName} (@${self.username}) requested a change to their ${PROFILE_FIELD_LABELS[field]}: "${desiredValue}"${note ? ` — ${note}` : ""}`,
    sourceAuditLogId: entry.id,
  });

  revalidatePath("/profile");
  return { success: "Request sent to your coordinator." };
}

export async function bulkReassignAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (!canBulkReassign(actor.role)) return { error: "You don't have permission to bulk reassign." };

  const consultantIds = formData.getAll("consultantIds").map(String);
  const newCoordinatorId = String(formData.get("newCoordinatorId"));

  if (consultantIds.length === 0) return { error: "Select at least one consultant." };
  if (!newCoordinatorId) return { error: "Choose a destination coordinator." };

  const newCoordinator = await prisma.user.findUnique({ where: { id: newCoordinatorId } });
  if (!newCoordinator || newCoordinator.role !== "COORDINATOR" || newCoordinator.status !== "ACTIVE") {
    return { error: "Destination coordinator is not valid." };
  }
  if (!canManageUser(actor, newCoordinator as ScopeSubject)) {
    return { error: "That coordinator is outside your scope." };
  }

  const consultants = await prisma.user.findMany({
    where: { id: { in: consultantIds }, role: "CONSULTANT", deletedAt: null },
  });

  const unauthorized = consultants.filter((c) => !canManageUser(actor, c as ScopeSubject));
  if (unauthorized.length > 0) {
    return { error: `${unauthorized.length} selected consultant(s) are outside your scope.` };
  }

  await prisma.user.updateMany({
    where: { id: { in: consultants.map((c) => c.id) } },
    data: { coordinatorId: newCoordinator.id, locationId: newCoordinator.locationId },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "CONSULTANTS_BULK_REASSIGNED",
    targetEntityType: "User",
    targetEntityId: newCoordinator.id,
    locationId: newCoordinator.locationId,
    metadata: { consultantIds: consultants.map((c) => c.id), newCoordinatorId: newCoordinator.id },
  });

  revalidatePath("/users/consultants");
  return { success: `${consultants.length} consultant(s) reassigned.` };
}
