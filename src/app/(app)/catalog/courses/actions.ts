"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageCatalogStructure } from "@/lib/auth/rbac";
import { courseSchema } from "@/lib/validation/catalog";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/app/(app)/users/actions";

async function requireCatalogManager() {
  const actor = await getCurrentUser();
  if (!actor || !canManageCatalogStructure(actor.role)) return null;
  return actor;
}

export async function createCourseAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireCatalogManager();
  if (!actor) return { error: "You don't have permission to manage courses." };

  const parsed = courseSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const course = await prisma.course.create({
    data: { name: parsed.data.name, description: parsed.data.description, createdByUserId: actor.id },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "COURSE_CREATED",
    targetEntityType: "Course",
    targetEntityId: course.id,
    courseId: course.id,
  });

  revalidatePath("/catalog/courses");
  return { success: `Course "${course.name}" created.` };
}

export async function updateCourseAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireCatalogManager();
  if (!actor) return { error: "You don't have permission to manage courses." };

  const id = String(formData.get("courseId") ?? "");
  const parsed = courseSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const course = await prisma.course.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "COURSE_UPDATED",
    targetEntityType: "Course",
    targetEntityId: course.id,
    courseId: course.id,
  });

  revalidatePath("/catalog/courses");
  revalidatePath(`/catalog/courses/${id}`);
  return { success: "Course updated." };
}

export async function setCourseStatusAction(formData: FormData): Promise<void> {
  const actor = await requireCatalogManager();
  if (!actor) return;

  const id = String(formData.get("courseId"));
  const nextStatus = String(formData.get("nextStatus")) as "ACTIVE" | "ARCHIVED";

  await prisma.course.update({ where: { id }, data: { status: nextStatus } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "COURSE_UPDATED",
    targetEntityType: "Course",
    targetEntityId: id,
    courseId: id,
    metadata: { status: nextStatus },
  });

  revalidatePath("/catalog/courses");
  revalidatePath(`/catalog/courses/${id}`);
}

export async function deleteCourseAction(formData: FormData): Promise<{ error?: string } | void> {
  const actor = await requireCatalogManager();
  if (!actor) return;

  const id = String(formData.get("courseId"));
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return;

  try {
    await prisma.course.delete({ where: { id } });
  } catch (error) {
    // P2003 = foreign key constraint failed. AuditLog.courseId and
    // ConsultantExtraCourse.courseId (extra-course assignments) are Restrict
    // (no cascade) — a course that's ever been assigned or referenced by an
    // audit log row can't be hard-deleted. Archiving is the only way to retire
    // a course in practice.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        error: `"${course.name}" can't be deleted — it's still referenced by assignment or audit history. Archive it instead to remove it from active selection lists.`,
      };
    }
    throw error;
  }

  await logAudit({
    actorUserId: actor.id,
    actionType: "COURSE_DELETED",
    targetEntityType: "Course",
    targetEntityId: id,
    metadata: { name: course.name },
  });

  revalidatePath("/catalog/courses");
}

export async function addVideoToCourseAction(formData: FormData): Promise<void> {
  const actor = await requireCatalogManager();
  if (!actor) return;

  const courseId = String(formData.get("courseId"));
  const videoId = String(formData.get("videoId"));
  if (!videoId) return;

  const existing = await prisma.courseVideo.findUnique({
    where: { courseId_videoId: { courseId, videoId } },
  });
  if (existing) return;

  const count = await prisma.courseVideo.count({ where: { courseId } });
  await prisma.courseVideo.create({ data: { courseId, videoId, sortOrder: count } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "COURSE_UPDATED",
    targetEntityType: "Course",
    targetEntityId: courseId,
    courseId,
    videoId,
    metadata: { action: "video_added" },
  });

  revalidatePath(`/catalog/courses/${courseId}`);
}

export async function removeVideoFromCourseAction(formData: FormData): Promise<void> {
  const actor = await requireCatalogManager();
  if (!actor) return;

  const courseId = String(formData.get("courseId"));
  const courseVideoId = String(formData.get("courseVideoId"));

  await prisma.courseVideo.delete({ where: { id: courseVideoId } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "COURSE_UPDATED",
    targetEntityType: "Course",
    targetEntityId: courseId,
    courseId,
    metadata: { action: "video_removed" },
  });

  revalidatePath(`/catalog/courses/${courseId}`);
}

export async function moveVideoInCourseAction(formData: FormData): Promise<void> {
  const actor = await requireCatalogManager();
  if (!actor) return;

  const courseId = String(formData.get("courseId"));
  const courseVideoId = String(formData.get("courseVideoId"));
  const direction = String(formData.get("direction")) as "up" | "down";

  const rows = await prisma.courseVideo.findMany({ where: { courseId }, orderBy: { sortOrder: "asc" } });
  const index = rows.findIndex((r) => r.id === courseVideoId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= rows.length) return;

  const a = rows[index];
  const b = rows[swapIndex];
  await prisma.$transaction([
    prisma.courseVideo.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.courseVideo.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidatePath(`/catalog/courses/${courseId}`);
}
