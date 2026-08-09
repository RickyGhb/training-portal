import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canManageUser, type ScopeSubject } from "@/lib/auth/rbac";
import { getPrimaryTrainingPath, getResolvedCourses, getConsultantProgress } from "@/lib/content-resolution";
import { StatusBadge } from "@/components/ui/Badge";
import { UsernameEditButton } from "@/components/users/UsernameEditButton";
import { VisaDobForm } from "@/components/users/VisaDobForm";
import { TrainerAssignForm } from "@/components/users/TrainerAssignForm";
import { OtterAssignForm } from "@/components/users/OtterAssignForm";
import { OFFSHORE_OFFICE_LABELS } from "@/lib/offshoreOfficeLabels";
import { ProfileFieldsForm } from "@/app/(app)/profile/ProfileFieldsForm";
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

  const [assignment, resolvedCourses, progress, trainingPaths, trainers, otterTeamMembers] = await Promise.all([
    getPrimaryTrainingPath(target.id),
    getResolvedCourses(target.id),
    getConsultantProgress(target.id),
    prisma.trainingPath.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "TRAINER", status: "ACTIVE", deletedAt: null }, orderBy: { firstName: "asc" } }),
    prisma.user.findMany({ where: { role: "OTTER_TEAM", status: "ACTIVE", deletedAt: null }, orderBy: { firstName: "asc" } }),
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
      <Link href="/users/consultants" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        ← Consultants
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="page-title">
          {target.firstName} {target.lastName}
        </h1>
        <StatusBadge status={target.status} />
      </div>
      <p className="page-subtitle">
        @{target.username}
        {target.email ? ` · ${target.email}` : ""}
        {target.phone ? ` · ${target.phone}` : ""}
        {target.location ? ` · ${target.location.name}` : ""}
        {target.coordinator ? ` · Coordinator: ${target.coordinator.firstName} ${target.coordinator.lastName}` : ""}
        {target.offshoreOffice ? ` · Offshore Office: ${OFFSHORE_OFFICE_LABELS[target.offshoreOffice]}` : ""}
        {target.technology ? ` · Technology: ${target.technology}` : ""}
        {` · ${target.marketingStatus === "IN_MARKETING" ? "In Marketing" : "In Training"}`}
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Edit profile</h2>
      <ProfileFieldsForm
        userId={target.id}
        firstName={target.firstName}
        lastName={target.lastName}
        email={target.email}
        phone={target.phone}
      />
      <div className="mt-3 flex max-w-md items-center justify-between card">
        <div>
          <p className="text-sm font-medium text-[var(--color-ink)]">Username</p>
          <p className="text-sm text-[var(--color-ink-soft)]">@{target.username}</p>
        </div>
        <UsernameEditButton userId={target.id} username={target.username} />
      </div>
      <VisaDobForm userId={target.id} visaType={target.visaType} dateOfBirth={target.dateOfBirth} />
      <TrainerAssignForm
        userId={target.id}
        trainerUserId={target.trainerUserId}
        trainers={trainers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}`, technology: t.technology }))}
      />
      <OtterAssignForm
        userId={target.id}
        otterTeamUserId={target.otterTeamUserId}
        otterTeamMembers={otterTeamMembers.map((o) => ({ id: o.id, name: `${o.firstName} ${o.lastName}` }))}
      />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Progress</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card">
          <div className="stat-number">{progress.completionPercentage}%</div>
          <div className="text-xs text-[var(--color-ink-soft)]">Complete</div>
        </div>
        <div className="card">
          <div className="stat-number">{progress.completedVideos}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">Videos completed</div>
        </div>
        <div className="card">
          <div className="stat-number">{progress.pendingVideos}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">Videos pending</div>
        </div>
        <div className="card">
          <div className="stat-number">{progress.totalCourses}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">Assigned courses</div>
        </div>
      </div>
      {progress.lastCompletedVideoTitle && (
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          Last completed: {progress.lastCompletedVideoTitle}
          {progress.lastCompletedAt && ` on ${progress.lastCompletedAt.toLocaleDateString()}`}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Primary training path</h2>
        <AssignPathButton
          consultantUserId={target.id}
          currentPathName={assignment?.trainingPath.name ?? null}
          paths={trainingPaths}
        />
      </div>
      <p className="mt-2 text-sm text-[var(--color-ink)]">
        {assignment ? assignment.trainingPath.name : <span className="text-[var(--color-ink-faint)]">Not assigned yet.</span>}
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Extra courses</h2>
      <ExtraCourses
        consultantUserId={target.id}
        extraCourses={extraCourses.map((c) => ({ id: c.id, name: c.name }))}
        availableCourses={availableForExtra}
      />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Resolved courses</h2>
      {resolvedCourses.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-ink-faint)]">No content assigned yet.</p>
      ) : (
        <ul className="mt-2  rounded-lg border border-[var(--color-border)] bg-white">
          {resolvedCourses.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="font-medium text-[var(--color-ink)]">{c.name}</span>
              <span className="text-xs text-[var(--color-ink-soft)]">
                {sourceLabel[c.source]} · {c.completedVideoCount}/{c.videoCount} videos
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
