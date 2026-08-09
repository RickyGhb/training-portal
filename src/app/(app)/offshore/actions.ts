"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/app/(app)/users/actions";
import { canManageTeamLead, type ScopeSubject } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/app/(app)/users/actions";

/**
 * Offshore Manager assigns (or unassigns, with an empty teamLeadId) a
 * Consultant in their own office to one of their Offshore Team Leads.
 */
export async function assignConsultantToTeamLeadAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (actor.role !== "OFFSHORE_MANAGER") return { error: "Not authorized." };

  const consultantId = String(formData.get("consultantId"));
  const teamLeadIdRaw = String(formData.get("teamLeadId") ?? "");
  const teamLeadId = teamLeadIdRaw.trim() === "" ? null : teamLeadIdRaw;

  const consultant = await prisma.user.findUnique({ where: { id: consultantId } });
  if (!consultant || consultant.deletedAt || consultant.role !== "CONSULTANT") {
    return { error: "Consultant not found." };
  }
  if (consultant.offshoreOffice !== actor.offshoreOffice) {
    return { error: "That consultant is outside your office." };
  }

  if (teamLeadId) {
    const teamLead = await prisma.user.findUnique({ where: { id: teamLeadId } });
    if (!teamLead || teamLead.deletedAt) return { error: "Team Lead not found." };
    if (!canManageTeamLead(actor, teamLead as ScopeSubject)) return { error: "That Team Lead is outside your office." };
  }

  await prisma.user.update({ where: { id: consultantId }, data: { offshoreTeamLeadId: teamLeadId } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "TEAM_LEAD_REASSIGNED",
    targetEntityType: "User",
    targetEntityId: consultantId,
    targetUserId: consultantId,
    locationId: consultant.locationId,
    metadata: { offshoreTeamLeadId: teamLeadId },
  });

  revalidatePath("/offshore/consultants");
  revalidatePath("/offshore/team-leads");
  revalidatePath("/offshore/my-consultants");
  return { success: "Team Lead assignment updated." };
}

/** CEO-only: moves a Team Lead to a different office (Team Leads otherwise stay in one office). */
export async function reassignTeamLeadOfficeAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (actor.role !== "CEO") return { error: "Not authorized." };

  const teamLeadId = String(formData.get("teamLeadId"));
  const newOffice = String(formData.get("newOffice"));
  if (newOffice !== "LOCATION_1" && newOffice !== "LOCATION_2") {
    return { error: "Choose a valid office." };
  }

  const teamLead = await prisma.user.findUnique({ where: { id: teamLeadId } });
  if (!teamLead || teamLead.deletedAt || teamLead.role !== "OFFSHORE_TEAM_LEAD") {
    return { error: "Team Lead not found." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: teamLeadId }, data: { offshoreOffice: newOffice } }),
    // Consultants already assigned to this Team Lead move offices with them
    // would be surprising — instead, unassign them, since the Team Lead no
    // longer shares an office with the consultants they left behind.
    prisma.user.updateMany({ where: { offshoreTeamLeadId: teamLeadId }, data: { offshoreTeamLeadId: null } }),
  ]);

  await logAudit({
    actorUserId: actor.id,
    actionType: "TEAM_LEAD_REASSIGNED",
    targetEntityType: "User",
    targetEntityId: teamLeadId,
    targetUserId: teamLeadId,
    metadata: { newOffice },
  });

  revalidatePath("/offshore/team-leads");
  return { success: "Team Lead moved to a different office. Their prior consultant assignments were cleared." };
}
