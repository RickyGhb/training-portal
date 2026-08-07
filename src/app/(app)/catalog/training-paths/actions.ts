"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageCatalogStructure } from "@/lib/auth/rbac";
import { trainingPathSchema } from "@/lib/validation/catalog";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/app/(app)/users/actions";

async function requireCeo() {
  const actor = await getCurrentUser();
  if (!actor || !canManageCatalogStructure(actor.role)) return null;
  return actor;
}

export async function createTrainingPathAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireCeo();
  if (!actor) return { error: "Only the CEO can manage training paths." };

  const parsed = trainingPathSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const path = await prisma.trainingPath.create({
    data: { name: parsed.data.name, description: parsed.data.description, createdByUserId: actor.id },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "TRAINING_PATH_CREATED",
    targetEntityType: "TrainingPath",
    targetEntityId: path.id,
    trainingPathId: path.id,
  });

  revalidatePath("/catalog/training-paths");
  return { success: `Training path "${path.name}" created.` };
}

export async function updateTrainingPathAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireCeo();
  if (!actor) return { error: "Only the CEO can manage training paths." };

  const id = String(formData.get("trainingPathId") ?? "");
  const parsed = trainingPathSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const path = await prisma.trainingPath.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "TRAINING_PATH_UPDATED",
    targetEntityType: "TrainingPath",
    targetEntityId: path.id,
    trainingPathId: path.id,
  });

  revalidatePath("/catalog/training-paths");
  revalidatePath(`/catalog/training-paths/${id}`);
  return { success: "Training path updated." };
}

export async function setTrainingPathStatusAction(formData: FormData): Promise<void> {
  const actor = await requireCeo();
  if (!actor) return;

  const id = String(formData.get("trainingPathId"));
  const nextStatus = String(formData.get("nextStatus")) as "ACTIVE" | "ARCHIVED";

  await prisma.trainingPath.update({ where: { id }, data: { status: nextStatus } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "TRAINING_PATH_UPDATED",
    targetEntityType: "TrainingPath",
    targetEntityId: id,
    trainingPathId: id,
    metadata: { status: nextStatus },
  });

  revalidatePath("/catalog/training-paths");
  revalidatePath(`/catalog/training-paths/${id}`);
}

export async function deleteTrainingPathAction(formData: FormData): Promise<void> {
  const actor = await requireCeo();
  if (!actor) return;

  const id = String(formData.get("trainingPathId"));
  const path = await prisma.trainingPath.findUnique({ where: { id } });
  if (!path) return;

  await prisma.trainingPath.delete({ where: { id } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "TRAINING_PATH_DELETED",
    targetEntityType: "TrainingPath",
    targetEntityId: id,
    metadata: { name: path.name },
  });

  revalidatePath("/catalog/training-paths");
}

export async function addCourseToPathAction(formData: FormData): Promise<void> {
  const actor = await requireCeo();
  if (!actor) return;

  const trainingPathId = String(formData.get("trainingPathId"));
  const courseId = String(formData.get("courseId"));
  if (!courseId) return;

  const existing = await prisma.trainingPathCourse.findUnique({
    where: { trainingPathId_courseId: { trainingPathId, courseId } },
  });
  if (existing) return;

  const count = await prisma.trainingPathCourse.count({ where: { trainingPathId } });
  await prisma.trainingPathCourse.create({
    data: { trainingPathId, courseId, sortOrder: count },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "TRAINING_PATH_UPDATED",
    targetEntityType: "TrainingPath",
    targetEntityId: trainingPathId,
    trainingPathId,
    courseId,
    metadata: { action: "course_added" },
  });

  revalidatePath(`/catalog/training-paths/${trainingPathId}`);
}

export async function removeCourseFromPathAction(formData: FormData): Promise<void> {
  const actor = await requireCeo();
  if (!actor) return;

  const trainingPathId = String(formData.get("trainingPathId"));
  const trainingPathCourseId = String(formData.get("trainingPathCourseId"));

  await prisma.trainingPathCourse.delete({ where: { id: trainingPathCourseId } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "TRAINING_PATH_UPDATED",
    targetEntityType: "TrainingPath",
    targetEntityId: trainingPathId,
    trainingPathId,
    metadata: { action: "course_removed" },
  });

  revalidatePath(`/catalog/training-paths/${trainingPathId}`);
}

export async function moveCourseInPathAction(formData: FormData): Promise<void> {
  const actor = await requireCeo();
  if (!actor) return;

  const trainingPathId = String(formData.get("trainingPathId"));
  const trainingPathCourseId = String(formData.get("trainingPathCourseId"));
  const direction = String(formData.get("direction")) as "up" | "down";

  const rows = await prisma.trainingPathCourse.findMany({
    where: { trainingPathId },
    orderBy: { sortOrder: "asc" },
  });
  const index = rows.findIndex((r) => r.id === trainingPathCourseId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= rows.length) return;

  const a = rows[index];
  const b = rows[swapIndex];
  await prisma.$transaction([
    prisma.trainingPathCourse.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.trainingPathCourse.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidatePath(`/catalog/training-paths/${trainingPathId}`);
}
