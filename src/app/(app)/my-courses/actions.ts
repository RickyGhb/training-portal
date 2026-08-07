"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Consultant self-service: mark one of their own assigned videos as completed. */
export async function markVideoCompletedAction(formData: FormData): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "CONSULTANT") return;

  const videoId = String(formData.get("videoId"));
  const courseId = String(formData.get("courseId"));

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video || video.status !== "ACTIVE") return;

  const existing = await prisma.videoCompletion.findUnique({
    where: { consultantUserId_videoId: { consultantUserId: actor.id, videoId } },
  });
  if (existing) return;

  await prisma.videoCompletion.create({
    data: { consultantUserId: actor.id, videoId, markedByUserId: actor.id },
  });

  revalidatePath(`/my-courses/${courseId}/${videoId}`);
  revalidatePath(`/my-courses/${courseId}`);
  revalidatePath("/my-courses");
  revalidatePath("/dashboard");
}
