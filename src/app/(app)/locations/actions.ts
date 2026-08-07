"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { createLocationSchema } from "@/lib/validation/user";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/app/(app)/users/actions";

export async function createLocationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "CEO") {
    return { error: "Only the CEO can create locations." };
  }

  const parsed = createLocationSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await prisma.location.findUnique({ where: { code: parsed.data.code } });
  if (existing) return { error: "A location with that code already exists." };

  const location = await prisma.location.create({
    data: { name: parsed.data.name, code: parsed.data.code, createdByUserId: actor.id },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "LOCATION_CREATED",
    targetEntityType: "Location",
    targetEntityId: location.id,
    locationId: location.id,
  });

  revalidatePath("/locations");
  return { success: `Location "${location.name}" created.` };
}

export async function setLocationStatusAction(formData: FormData): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "CEO") return;

  const locationId = String(formData.get("locationId"));
  const nextStatus = String(formData.get("nextStatus")) as "ACTIVE" | "ARCHIVED";

  await prisma.location.update({ where: { id: locationId }, data: { status: nextStatus } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "LOCATION_UPDATED",
    targetEntityType: "Location",
    targetEntityId: locationId,
    locationId,
    metadata: { status: nextStatus },
  });

  revalidatePath("/locations");
}
