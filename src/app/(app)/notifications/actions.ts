"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor) return;

  const id = String(formData.get("notificationId"));
  await prisma.notification.updateMany({
    where: { id, recipientUserId: actor.id },
    data: { isRead: true },
  });

  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor) return;

  await prisma.notification.updateMany({
    where: { recipientUserId: actor.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notifications");
}
