import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter, canExportReports } from "@/lib/auth/rbac";
import { getDashboardAggregates, getConsultantReportRows, type ConsultantReportFilters } from "@/lib/reports";
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role === "CONSULTANT") redirect("/dashboard");

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

  const [aggregates, rows, locations, coordinators, trainingPaths] = await Promise.all([
    getDashboardAggregates(actor),
    getConsultantReportRows(actor, filters),
    actor.role === "CEO" || actor.role === "MANAGER"
      ? prisma.location.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    actor.role !== "COORDINATOR"
      ? prisma.user.findMany({
          where: { role: "COORDINATOR", status: "ACTIVE", deletedAt: null, ...userVisibilityFilter(actor) },
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
    prisma.trainingPath.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            {actor.role === "COORDINATOR" ? "Your consultants only." : "Scoped to what you can manage."}
          </p>
        </div>
        {canExportReports(actor.role) && (
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
            <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Location</label>
            <select name="locationId" defaultValue={filters.locationId ?? ""} className="w-44 field">
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
            <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Coordinator</label>
            <select name="coordinatorId" defaultValue={filters.coordinatorId ?? ""} className="w-44 field">
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
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Training path</label>
          <select name="trainingPathId" defaultValue={filters.trainingPathId ?? ""} className="w-44 field">
            <option value="">All</option>
            {trainingPaths.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Status</label>
          <select name="status" defaultValue={filters.status ?? ""} className="w-40 field">
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
