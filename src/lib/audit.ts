import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuditActionType, NotificationType, Prisma, PrismaClient } from "@/generated/prisma/client";

type LogAuditInput = {
  actorUserId: string | null;
  actionType: AuditActionType;
  targetEntityType: string;
  targetEntityId?: string | null;
  targetUserId?: string | null;
  locationId?: string | null;
  trainingPathId?: string | null;
  courseId?: string | null;
  videoId?: string | null;
  formId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * `client` defaults to the global singleton but can be a `$transaction`
 * callback's `tx` so the audit row commits atomically with the mutation it
 * describes (see evaluateMarketingReadiness for the motivating case).
 */
export async function logAudit(
  input: LogAuditInput,
  client: PrismaClient | Prisma.TransactionClient = prisma
) {
  return client.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actionType: input.actionType,
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId,
      targetUserId: input.targetUserId,
      locationId: input.locationId,
      trainingPathId: input.trainingPathId,
      courseId: input.courseId,
      videoId: input.videoId,
      formId: input.formId,
      metadataJson: input.metadata,
    },
  });
}

/**
 * Notifies every CEO account. Only called for the three trigger events per
 * spec: report exports by Manager, consultant deletion, password reset.
 */
export async function notifyCeos(params: {
  type: NotificationType;
  title: string;
  body: string;
  sourceAuditLogId: string;
}) {
  const ceos = await prisma.user.findMany({
    where: { role: "CEO", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  if (ceos.length === 0) return;

  await prisma.notification.createMany({
    data: ceos.map((ceo) => ({
      recipientUserId: ceo.id,
      type: params.type,
      title: params.title,
      body: params.body,
      sourceAuditLogId: params.sourceAuditLogId,
    })),
  });
}

/** Notifies a single specific user (e.g. a consultant's coordinator). */
export async function notifyUser(params: {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  sourceAuditLogId: string;
}) {
  await prisma.notification.create({ data: params });
}
