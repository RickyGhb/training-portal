import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canManageUser, type ScopeSubject } from "@/lib/auth/rbac";
import { getPrimaryTrainingPath, getResolvedCourses, getConsultantProgress } from "@/lib/content-resolution";
import { StatusBadge } from "@/components/ui/Badge";
import { AssignPathButton } from "./assign-path-button";
import { ExtraCourses } from "./extra-courses";

export default async function ConsultantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role === "CONSULTANT") redirect("/dashboard");

  const target = await prisma.user.findUnique({
    where: { id },
    include: { location: true, coordinator: true },
  });
  if (!target || target.deletedAt || target.role !== "CONSULTANT") notFound();
  if (!canManageUser(actor, target as ScopeSubject)) redirect("/users/consultants");

  const [assignment, resolvedCourses, progress, trainingPaths] = await Promise.all([
    getPrimaryTrainingPath(target.id),
    getResolvedCourses(target.id),
    getConsultantProgress(target.id),
    prisma.trainingPath.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  const resolvedCourseIds = new Set(resolvedCourses.map((c) => c.id));
  const extraCourses = resolvedCourses.filter((c) => c.source === "extra" || c.source === "both");
  const availableForExtra = await prisma.course.findMany({
    where: { status: "ACTIVE", id: { notIn: [...resolvedCourseIds] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const sourceLabel: Record<string, string> = {
    path: "Assigned by path",
    extra: "Extra course",
    both: "Assigned by path + Extra",
  };

  return (
    <div>
      <Link href="/users/consultants" className="text-sm text-slate-500 hover:text-slate-700">
        ← Consultants
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          {target.firstName} {target.lastName}
        </h1>
        <StatusBadge status={target.status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        @{target.username}
        {target.email ? ` · ${target.email}` : ""}
        {target.phone ? ` · ${target.phone}` : ""}
        {target.location ? ` · ${target.location.name}` : ""}
        {target.coordinator ? ` · Coordinator: ${target.coordinator.firstName} ${target.coordinator.lastName}` : ""}
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Progress</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-slate-900">{progress.completionPercentage}%</div>
          <div className="text-xs text-slate-500">Complete</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-slate-900">{progress.completedVideos}</div>
          <div className="text-xs text-slate-500">Videos completed</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-slate-900">{progress.pendingVideos}</div>
          <div className="text-xs text-slate-500">Videos pending</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-slate-900">{progress.totalCourses}</div>
          <div className="text-xs text-slate-500">Assigned courses</div>
        </div>
      </div>
      {progress.lastCompletedVideoTitle && (
        <p className="mt-2 text-xs text-slate-500">
          Last completed: {progress.lastCompletedVideoTitle}
          {progress.lastCompletedAt && ` on ${progress.lastCompletedAt.toLocaleDateString()}`}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Primary training path</h2>
        <AssignPathButton
          consultantUserId={target.id}
          currentPathName={assignment?.trainingPath.name ?? null}
          paths={trainingPaths}
        />
      </div>
      <p className="mt-2 text-sm text-slate-700">
        {assignment ? assignment.trainingPath.name : <span className="text-slate-400">Not assigned yet.</span>}
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Extra courses</h2>
      <ExtraCourses
        consultantUserId={target.id}
        extraCourses={extraCourses.map((c) => ({ id: c.id, name: c.name }))}
        availableCourses={availableForExtra}
      />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Resolved courses</h2>
      {resolvedCourses.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No content assigned yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {resolvedCourses.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="font-medium text-slate-900">{c.name}</span>
              <span className="text-xs text-slate-500">
                {sourceLabel[c.source]} · {c.completedVideoCount}/{c.videoCount} videos
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
