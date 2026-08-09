import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit, notifyUser } from "@/lib/audit";

/**
 * Checks whether a Consultant's latest Trainer verdict AND latest Otter Team
 * verdict are both READY. If so (and they aren't already IN_MARKETING),
 * flips marketingStatus and notifies the Offshore Manager(s) for their
 * office, their Offshore Team Lead (if assigned), and their Location
 * Manager/Location Admin. Called after every feedback submission — cheap
 * enough to just recompute from scratch rather than tracking partial state.
 */
export async function evaluateMarketingReadiness(consultantUserId: string) {
  const [consultant, latestTrainerFeedback, latestOtterFeedback] = await Promise.all([
    prisma.user.findUnique({ where: { id: consultantUserId } }),
    prisma.trainerFeedback.findFirst({
      where: { consultantUserId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.otterFeedback.findFirst({
      where: { consultantUserId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!consultant || consultant.role !== "CONSULTANT" || consultant.marketingStatus === "IN_MARKETING") return;

  const ready = latestTrainerFeedback?.verdict === "READY" && latestOtterFeedback?.verdict === "READY";
  if (!ready) return;

  await prisma.user.update({ where: { id: consultantUserId }, data: { marketingStatus: "IN_MARKETING" } });

  const entry = await logAudit({
    actorUserId: null,
    actionType: "MARKETING_STATUS_CHANGED",
    targetEntityType: "User",
    targetEntityId: consultantUserId,
    targetUserId: consultantUserId,
    locationId: consultant.locationId,
    metadata: { newStatus: "IN_MARKETING" },
  });

  const recipientIds = new Set<string>();

  if (consultant.offshoreOffice) {
    const offshoreManagers = await prisma.user.findMany({
      where: { role: "OFFSHORE_MANAGER", offshoreOffice: consultant.offshoreOffice, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    offshoreManagers.forEach((m) => recipientIds.add(m.id));
  }
  if (consultant.offshoreTeamLeadId) recipientIds.add(consultant.offshoreTeamLeadId);

  if (consultant.locationId) {
    const locationStaff = await prisma.user.findMany({
      where: {
        role: { in: ["LOCATION_MANAGER", "LOCATION_ADMIN"] },
        locationId: consultant.locationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });
    locationStaff.forEach((s) => recipientIds.add(s.id));
  }

  const body = `${consultant.firstName} ${consultant.lastName} (@${consultant.username}) is ready for marketing — both Trainer and Otter Team signed off.`;

  await Promise.all(
    [...recipientIds].map((recipientUserId) =>
      notifyUser({
        recipientUserId,
        type: "MARKETING_READY",
        title: "Consultant ready for marketing",
        body,
        sourceAuditLogId: entry.id,
      })
    )
  );
}
