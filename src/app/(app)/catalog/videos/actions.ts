"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageVideos } from "@/lib/auth/rbac";
import { videoSchema, videoEditSchema } from "@/lib/validation/catalog";
import { parseDriveLink } from "@/lib/drive";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/app/(app)/users/actions";

async function requireVideoManager() {
  const actor = await getCurrentUser();
  if (!actor || !canManageVideos(actor.role)) return null;
  return actor;
}

export async function createVideoAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireVideoManager();
  if (!actor) return { error: "You don't have permission to manage videos." };

  const parsed = videoSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    driveUrl: formData.get("driveUrl"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    durationSeconds: formData.get("durationSeconds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const drive = parseDriveLink(parsed.data.driveUrl);
  if (!drive.valid) return { error: drive.error };

  const existing = await prisma.video.findUnique({ where: { driveFileId: drive.fileId } });
  if (existing) return { error: `That video is already in the catalog as "${existing.title}".` };

  const video = await prisma.video.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      driveSourceUrl: parsed.data.driveUrl,
      driveFileId: drive.fileId,
      embedUrl: drive.embedUrl,
      thumbnailUrl: parsed.data.thumbnailUrl,
      durationSeconds: parsed.data.durationSeconds,
      createdByUserId: actor.id,
    },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "VIDEO_CREATED",
    targetEntityType: "Video",
    targetEntityId: video.id,
    videoId: video.id,
  });

  revalidatePath("/catalog/videos");
  return { success: `Video "${video.title}" added.` };
}

export async function updateVideoAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireVideoManager();
  if (!actor) return { error: "You don't have permission to manage videos." };

  const id = String(formData.get("videoId") ?? "");
  const parsed = videoEditSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    durationSeconds: formData.get("durationSeconds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const video = await prisma.video.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      thumbnailUrl: parsed.data.thumbnailUrl,
      durationSeconds: parsed.data.durationSeconds,
      updatedByUserId: actor.id,
    },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "VIDEO_UPDATED",
    targetEntityType: "Video",
    targetEntityId: video.id,
    videoId: video.id,
  });

  revalidatePath("/catalog/videos");
  return { success: "Video updated." };
}

export async function setVideoStatusAction(formData: FormData): Promise<void> {
  const actor = await requireVideoManager();
  if (!actor) return;

  const id = String(formData.get("videoId"));
  const nextStatus = String(formData.get("nextStatus")) as "ACTIVE" | "ARCHIVED";

  await prisma.video.update({ where: { id }, data: { status: nextStatus, updatedByUserId: actor.id } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "VIDEO_UPDATED",
    targetEntityType: "Video",
    targetEntityId: id,
    videoId: id,
    metadata: { status: nextStatus },
  });

  revalidatePath("/catalog/videos");
}

export async function deleteVideoAction(formData: FormData): Promise<void> {
  const actor = await requireVideoManager();
  if (!actor) return;

  const id = String(formData.get("videoId"));
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return;

  await prisma.video.delete({ where: { id } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "VIDEO_DELETED",
    targetEntityType: "Video",
    targetEntityId: id,
    metadata: { title: video.title },
  });

  revalidatePath("/catalog/videos");
}
