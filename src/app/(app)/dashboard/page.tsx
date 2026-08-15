import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrimaryTrainingPath, getConsultantProgress } from "@/lib/content-resolution";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter, canExportReports } from "@/lib/auth/rbac";
import { getDashboardData, type ConsultantReportFilters } from "@/lib/reports";
import { StatusBadge } from "@/components/ui/Badge";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="stat-number">{value}</div>
      <div className="text-xs text-[var(--color-ink-soft)]">{label}</div>
    </div>
  );
}

function BreakdownList({ title, rows, suffix }: { title: string; rows: { name: string; count?: number; avgCompletionPercentage?: number }[]; suffix: string }) {
  return (
    <div className="card">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-ink-faint)]">No data.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between text-[var(--color-ink)]">
              <span>{r.name}</span>
              <span className="font-medium text-[var(--color-ink)]">
                {r.count ?? r.avgCompletionPercentage}
                {suffix}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  // These four roles get dedicated landing pages rather than the org-wide
  // reporting dashboard below (which is built around the location hierarchy
  // they aren't part of).
  if (user.role === "OFFSHORE_MANAGER") redirect("/offshore/consultants");
  if (user.role === "OFFSHORE_TEAM_LEAD") redirect("/offshore/my-consultants");
  if (user.role === "TRAINER") redirect("/trainer/consultants");
  if (user.role === "OTTER_TEAM") redirect("/otter/consultants");

  if (user.role === "CONSULTANT") {
    const [assignment, progress] = await Promise.all([
      getPrimaryTrainingPath(user.id),
      getConsultantProgress(user.id),
    ]);

    return (
      <div>
        <h1 className="page-title">Welcome, {user.firstName}</h1>
        <p className="page-subtitle">
          {assignment ? `Training path: ${assignment.trainingPath.name}` : "No training path assigned yet."}
          {" · "}
          {user.marketingStatus === "IN_MARKETING" ? "In Marketing" : "In Training"}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        <Link href="/my-courses" className="mt-6 inline-block btn-primary">
          Go to My Courses
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const filters: ConsultantReportFilters = {
    locationId: typeof sp.locationId === "string" && sp.locationId ? sp.locationId : undefined,
    coordinatorId: typeof sp.coordinatorId === "string" && sp.coordinatorId ? sp.coordinatorId : undefined,
    trainingPathId: typeof sp.trainingPathId === "string" && sp.trainingPathId ? sp.trainingPathId : undefined,
    status:
      typeof sp.status === "string" && ["ACTIVE", "DEACTIVATED", "DELETED"].includes(sp.status)
        ? (sp.status as "ACTIVE" | "DEACTIVATED" | "DELETED")
        : undefined,
  };

  const [{ aggregates, rows }, locations, coordinators, trainingPaths] = await Promise.all([
    getDashboardData(user, filters),
    user.role === "CEO"
      ? prisma.location.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    user.role !== "COORDINATOR"
      ? prisma.user.findMany({
          // userVisibilityFilter(user) also returns a `role` key (e.g. `{ notIn: [...] }`
          // for Location Manager/Location Admin) — spread it first so the explicit
          // `role: "COORDINATOR"` below always wins, instead of being silently
          // clobbered by the broader scope filter.
          where: { status: "ACTIVE", deletedAt: null, ...userVisibilityFilter(user), role: "COORDINATOR" },
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
    prisma.trainingPath.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Welcome, {user.firstName}</h1>
          <p className="page-subtitle">
            {user.role === "COORDINATOR" ? "Your consultants only." : "Scoped to what you can manage."}
          </p>
        </div>
        {canExportReports(user.role) && (
          <a
            href={`/reports/exports?${new URLSearchParams(
              Object.entries(filters).filter(([, v]) => v) as [string, string][]
            ).toString()}`}
            className="btn-primary"
          >
            Export
          </a>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Total consultants" value={aggregates.totalConsultants} />
        <Tile label="Active" value={aggregates.activeConsultants} />
        <Tile label="Deactivated" value={aggregates.deactivatedConsultants} />
        <Tile label="Deleted (archived)" value={aggregates.deletedConsultants} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <BreakdownList title="Consultants by training path" rows={aggregates.consultantsByTrainingPath} suffix="" />
        <BreakdownList title="Consultants by coordinator" rows={aggregates.consultantsByCoordinator} suffix="" />
        <BreakdownList title="Consultants by location" rows={aggregates.consultantsByLocation} suffix="" />
        <BreakdownList title="Avg. completion by path" rows={aggregates.completionByPath} suffix="%" />
        <BreakdownList title="Avg. completion by coordinator" rows={aggregates.completionByCoordinator} suffix="%" />
      </div>

      <form method="GET" className="mt-8 flex flex-wrap items-end gap-3 card">
        {locations.length > 0 && (
          <div>
            <label htmlFor="filter-location" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Location
            </label>
            <select id="filter-location" name="locationId" defaultValue={filters.locationId ?? ""} className="w-44 field">
              <option value="">All</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {coordinators.length > 0 && (
          <div>
            <label htmlFor="filter-coordinator" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Coordinator
            </label>
            <select id="filter-coordinator" name="coordinatorId" defaultValue={filters.coordinatorId ?? ""} className="w-44 field">
              <option value="">All</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="filter-training-path" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Training path
          </label>
          <select id="filter-training-path" name="trainingPathId" defaultValue={filters.trainingPathId ?? ""} className="w-44 field">
            <option value="">All</option>
            {trainingPaths.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-status" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Status
          </label>
          <select id="filter-status" name="status" defaultValue={filters.status ?? ""} className="w-40 field">
            <option value="">Active + deactivated</option>
            <option value="ACTIVE">Active only</option>
            <option value="DEACTIVATED">Deactivated only</option>
            <option value="DELETED">Deleted (archived)</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Apply filters
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
        <table className="w-full text-sm">
          <thead className="">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Coordinator</th>
              <th className="px-4 py-2">Training path</th>
              <th className="px-4 py-2">Extra courses</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2">Last activity</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-[var(--color-ink)]">
                  {r.firstName} {r.lastName}
                </td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">{r.locationName ?? "—"}</td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">{r.coordinatorName ?? "—"}</td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">{r.primaryTrainingPathName ?? "—"}</td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">{r.extraCourseNames.join(", ") || "—"}</td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                  {r.completedVideos}/{r.totalVideos} ({r.completionPercentage}%)
                </td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                  {r.lastCompletedItem ? `${r.lastCompletedItem}${r.lastActivityDate ? ` · ${r.lastActivityDate.toLocaleDateString()}` : ""}` : "—"}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                  No consultants match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
