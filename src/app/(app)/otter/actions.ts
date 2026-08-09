"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActor, type FormState } from "@/app/(app)/users/actions";
import { canViewAsOtterTeam, type ScopeSubject } from "@/lib/auth/rbac";
import { submitFeedbackSchema } from "@/lib/validation/user";
import { logAudit } from "@/lib/audit";
import { evaluateMarketingReadiness } from "@/lib/marketingReadiness";

export async function submitOtterFeedbackAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (actor.role !== "OTTER_TEAM") return { error: "Not authorized." };

  const consultantUserId = String(formData.get("consultantUserId"));

  const parsed = submitFeedbackSchema.safeParse({
    verdict: formData.get("verdict"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const consultant = await prisma.user.findUnique({ where: { id: consultantUserId } });
  if (!consultant || consultant.deletedAt || consultant.role !== "CONSULTANT") {
    return { error: "Consultant not found." };
  }
  if (!canViewAsOtterTeam(actor, consultant as ScopeSubject)) return { error: "Not authorized." };

  const { verdict, notes } = parsed.data;

  await prisma.otterFeedback.create({
    data: { consultantUserId, otterUserId: actor.id, verdict, notes: notes ?? null },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "OTTER_FEEDBACK_SUBMITTED",
    targetEntityType: "User",
    targetEntityId: consultantUserId,
    targetUserId: consultantUserId,
    locationId: consultant.locationId,
    metadata: { verdict, notes: notes ?? null },
  });

  await evaluateMarketingReadiness(consultantUserId);

  revalidatePath("/otter/consultants");
  return { success: "Feedback submitted." };
}
