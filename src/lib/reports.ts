import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { getConsultantProgressBatch } from "@/lib/content-resolution";

/**
 * Reporting queries per Technical Implementation Blueprint.md §12 (dashboard
 * aggregates + consultant-level metrics) and §19 (filtering model). Scope is
 * always applied server-side — the same visibility rule as everywhere else:
 * CEO sees everything; Location Manager and Location Admin are each confined
 * to their own location; Coordinator to their own consultants.
 */

export function consultantScopeFilter(actor: SessionUser) {
  switch (actor.role) {
    case "CEO":
      return {};
    case "LOCATION_MANAGER":
    case "LOCATION_ADMIN":
      return actor.locationId ? { locationId: actor.locationId } : { id: "__none__" };
    case "COORDINATOR":
      return { coordinatorId: actor.id };
    default:
      return { id: "__none__" };
  }
}

export type DashboardAggregates = {
  totalConsultants: number;
  activeConsultants: number;
  deactivatedConsultants: number;
  deletedConsultants: number;
  consultantsByTrainingPath: { name: string; count: number }[];
  consultantsByCoordinator: { name: string; count: number }[];
  consultantsByLocation: { name: string; count: number }[];
  completionByPath: { name: string; avgCompletionPercentage: number }[];
  completionByCoordinator: { name: string; avgCompletionPercentage: number }[];
};

export async function getDashboardAggregates(actor: SessionUser): Promise<DashboardAggregates> {
  const scope = consultantScopeFilter(actor);
  const baseWhere = { role: "CONSULTANT" as const, ...scope };

  const [activeConsultants, deactivatedConsultants, deletedConsultants, consultants] = await Promise.all([
    prisma.user.count({ where: { ...baseWhere, status: "ACTIVE", deletedAt: null } }),
    prisma.user.count({ where: { ...baseWhere, status: "DEACTIVATED", deletedAt: null } }),
    prisma.user.count({ where: { ...baseWhere, deletedAt: { not: null } } }),
    prisma.user.findMany({
      where: { ...baseWhere, deletedAt: null },
      select: {
        id: true,
        location: { select: { name: true } },
        coordinator: { select: { firstName: true, lastName: true } },
        trainingAssignment: { select: { trainingPath: { select: { name: true } } } },
      },
    }),
  ]);

  const progressByConsultant = await getConsultantProgressBatch(consultants.map((c) => c.id));

  const countBy = new Map<string, number>();
  const coordCountBy = new Map<string, number>();
  const locCountBy = new Map<string, number>();
  const pathCompletion = new Map<string, { totalPct: number; count: number }>();
  const coordCompletion = new Map<string, { totalPct: number; count: number }>();

  consultants.forEach((c) => {
    const pathName = c.trainingAssignment?.trainingPath.name ?? "Unassigned";
    const coordName = c.coordinator ? `${c.coordinator.firstName} ${c.coordinator.lastName}` : "Independent / none";
    const locName = c.location?.name ?? "No location";
    const pct = progressByConsultant.get(c.id)?.completionPercentage ?? 0;

    countBy.set(pathName, (countBy.get(pathName) ?? 0) + 1);
    coordCountBy.set(coordName, (coordCountBy.get(coordName) ?? 0) + 1);
    locCountBy.set(locName, (locCountBy.get(locName) ?? 0) + 1);

    const pathEntry = pathCompletion.get(pathName) ?? { totalPct: 0, count: 0 };
    pathEntry.totalPct += pct;
    pathEntry.count += 1;
    pathCompletion.set(pathName, pathEntry);

    const coordEntry = coordCompletion.get(coordName) ?? { totalPct: 0, count: 0 };
    coordEntry.totalPct += pct;
    coordEntry.count += 1;
    coordCompletion.set(coordName, coordEntry);
  });

  const toCountRows = (m: Map<string, number>) =>
    [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const toCompletionRows = (m: Map<string, { totalPct: number; count: number }>) =>
    [...m.entries()]
      .map(([name, { totalPct, count }]) => ({ name, avgCompletionPercentage: Math.round(totalPct / count) }))
      .sort((a, b) => b.avgCompletionPercentage - a.avgCompletionPercentage);

  return {
    totalConsultants: activeConsultants + deactivatedConsultants,
    activeConsultants,
    deactivatedConsultants,
    deletedConsultants,
    consultantsByTrainingPath: toCountRows(countBy),
    consultantsByCoordinator: toCountRows(coordCountBy),
    consultantsByLocation: toCountRows(locCountBy),
    completionByPath: toCompletionRows(pathCompletion),
    completionByCoordinator: toCompletionRows(coordCompletion),
  };
}

export type ConsultantReportFilters = {
  locationId?: string;
  coordinatorId?: string;
  trainingPathId?: string;
  status?: "ACTIVE" | "DEACTIVATED" | "DELETED";
};

export type ConsultantReportRow = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  phone: string | null;
  locationName: string | null;
  coordinatorName: string | null;
  primaryTrainingPathName: string | null;
  extraCourseNames: string[];
  status: "ACTIVE" | "DEACTIVATED" | "DELETED";
  completedVideos: number;
  totalVideos: number;
  completionPercentage: number;
  lastCompletedItem: string | null;
  lastActivityDate: Date | null;
};

export async function getConsultantReportRows(
  actor: SessionUser,
  filters: ConsultantReportFilters = {}
): Promise<ConsultantReportRow[]> {
  const scope = consultantScopeFilter(actor);

  // Scope and filters are combined with AND, not merged into one object — a
  // merge would let a same-named filter key (locationId, coordinatorId)
  // silently overwrite the scope key via object spread, letting e.g. a
  // Coordinator pass ?coordinatorId=<someone else> and see consultants
  // outside their scope. AND means a filter can only narrow within scope,
  // never widen it: if it contradicts scope, the query returns zero rows.
  const where = {
    role: "CONSULTANT" as const,
    ...(filters.status === "DELETED" ? { deletedAt: { not: null } } : { deletedAt: null }),
    AND: [
      scope,
      filters.locationId ? { locationId: filters.locationId } : {},
      filters.coordinatorId ? { coordinatorId: filters.coordinatorId } : {},
      filters.trainingPathId ? { trainingAssignment: { trainingPathId: filters.trainingPathId } } : {},
      filters.status && filters.status !== "DELETED" ? { status: filters.status } : {},
    ],
  };

  const consultants = await prisma.user.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      location: { select: { name: true } },
      coordinator: { select: { firstName: true, lastName: true } },
      trainingAssignment: { select: { trainingPath: { select: { name: true } } } },
      extraCourses: { include: { course: { select: { name: true } } } },
    },
  });

  const progressByConsultant = await getConsultantProgressBatch(consultants.map((c) => c.id));

  return consultants.map((c) => {
    const progress = progressByConsultant.get(c.id);
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      username: c.username,
      email: c.email,
      phone: c.phone,
      locationName: c.location?.name ?? null,
      coordinatorName: c.coordinator ? `${c.coordinator.firstName} ${c.coordinator.lastName}` : null,
      primaryTrainingPathName: c.trainingAssignment?.trainingPath.name ?? null,
      extraCourseNames: c.extraCourses.map((ec) => ec.course.name),
      status: c.status,
      completedVideos: progress?.completedVideos ?? 0,
      totalVideos: progress?.totalVideos ?? 0,
      completionPercentage: progress?.completionPercentage ?? 0,
      lastCompletedItem: progress?.lastCompletedVideoTitle ?? null,
      lastActivityDate: progress?.lastCompletedAt ?? null,
    };
  });
}
