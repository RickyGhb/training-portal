"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { canAssignTrainingPath, canAssignExtraCourses, type ScopeSubject } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/app/(app)/users/actions";

async function requireActor(): Promise<SessionUser> {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Not authenticated");
  return actor;
}

async function loadConsultantTarget(consultantUserId: string) {
  const target = await prisma.user.findUnique({ where: { id: consultantUserId } });
  if (!target || target.deletedAt || target.role !== "CONSULTANT") return null;
  return target;
}

export async function assignTrainingPathAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  const consultantUserId = String(formData.get("consultantUserId") ?? "");
  const trainingPathId = String(formData.get("trainingPathId") ?? "");
  if (!trainingPathId) return { error: "Select a training path." };

  const target = await loadConsultantTarget(consultantUserId);
  if (!target) return { error: "Consultant not found." };
  if (!canAssignTrainingPath(actor, target as ScopeSubject)) {
    return { error: "You don't have permission to assign a training path for this consultant." };
  }

  const path = await prisma.trainingPath.findUnique({ where: { id: trainingPathId } });
  if (!path || path.status !== "ACTIVE") return { error: "That training path isn't available." };

  const existing = await prisma.consultantTrainingAssignment.findUnique({ where: { consultantUserId } });

  await prisma.consultantTrainingAssignment.upsert({
    where: { consultantUserId },
    create: { consultantUserId, trainingPathId, assignedByUserId: actor.id },
    update: { trainingPathId, assignedByUserId: actor.id, assignedAt: new Date() },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: existing ? "TRAINING_PATH_CHANGED" : "TRAINING_PATH_ASSIGNED",
    targetEntityType: "User",
    targetEntityId: consultantUserId,
    targetUserId: consultantUserId,
    trainingPathId,
    locationId: target.locationId,
    metadata: { previousTrainingPathId: existing?.trainingPathId ?? null, newTrainingPathId: trainingPathId },
  });

  revalidatePath(`/users/consultants/${consultantUserId}`);
  return { success: `Primary training path set to "${path.name}".` };
}

export async function addExtraCourseAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const consultantUserId = String(formData.get("consultantUserId"));
  const courseId = String(formData.get("courseId"));
  if (!courseId) return;

  const target = await loadConsultantTarget(consultantUserId);
  if (!target) return;
  if (!canAssignExtraCourses(actor, target as ScopeSubject)) return;

  const existing = await prisma.consultantExtraCourse.findUnique({
    where: { consultantUserId_courseId: { consultantUserId, courseId } },
  });
  if (existing) return;

  await prisma.consultantExtraCourse.create({
    data: { consultantUserId, courseId, assignedByUserId: actor.id },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "EXTRA_COURSE_ASSIGNED",
    targetEntityType: "User",
    targetEntityId: consultantUserId,
    targetUserId: consultantUserId,
    courseId,
    locationId: target.locationId,
  });

  revalidatePath(`/users/consultants/${consultantUserId}`);
}

export async function removeExtraCourseAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const consultantUserId = String(formData.get("consultantUserId"));
  const courseId = String(formData.get("courseId"));

  const target = await loadConsultantTarget(consultantUserId);
  if (!target) return;
  if (!canAssignExtraCourses(actor, target as ScopeSubject)) return;

  await prisma.consultantExtraCourse.deleteMany({ where: { consultantUserId, courseId } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "EXTRA_COURSE_REMOVED",
    targetEntityType: "User",
    targetEntityId: consultantUserId,
    targetUserId: consultantUserId,
    courseId,
    locationId: target.locationId,
  });

  revalidatePath(`/users/consultants/${consultantUserId}`);
}
