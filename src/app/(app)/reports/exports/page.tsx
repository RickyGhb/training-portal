import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter, canExportReports } from "@/lib/auth/rbac";

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (!canExportReports(actor.role)) redirect("/dashboard");

  const sp = await searchParams;
  const defaults = {
    locationId: typeof sp.locationId === "string" ? sp.locationId : "",
    coordinatorId: typeof sp.coordinatorId === "string" ? sp.coordinatorId : "",
    trainingPathId: typeof sp.trainingPathId === "string" ? sp.trainingPathId : "",
    status: typeof sp.status === "string" ? sp.status : "",
  };

  const [locations, coordinators, trainingPaths] = await Promise.all([
    actor.role === "CEO" || actor.role === "MANAGER"
      ? prisma.location.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { role: "COORDINATOR", status: "ACTIVE", deletedAt: null, ...userVisibilityFilter(actor) },
      orderBy: { firstName: "asc" },
    }),
    prisma.trainingPath.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="page-title">Export Consultant Report</h1>
      <p className="page-subtitle">
        Choose filters, then download. Every export is logged, and Manager exports notify the CEO.
      </p>

      <form method="GET" action="/api/reports/export" className="mt-6 space-y-4 card">
        <div className="flex flex-wrap gap-3">
          {locations.length > 0 && (
            <div>
              <label htmlFor="export-location" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
                Location
              </label>
              <select id="export-location" name="locationId" defaultValue={defaults.locationId} className="w-44 field">
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
              <label htmlFor="export-coordinator" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
                Coordinator
              </label>
              <select id="export-coordinator" name="coordinatorId" defaultValue={defaults.coordinatorId} className="w-44 field">
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
            <label htmlFor="export-training-path" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Training path
            </label>
            <select id="export-training-path" name="trainingPathId" defaultValue={defaults.trainingPathId} className="w-44 field">
              <option value="">All</option>
              {trainingPaths.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="export-status" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Status
            </label>
            <select id="export-status" name="status" defaultValue={defaults.status} className="w-40 field">
              <option value="">Active + deactivated</option>
              <option value="ACTIVE">Active only</option>
              <option value="DEACTIVATED">Deactivated only</option>
              <option value="DELETED">Deleted (archived)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" name="format" value="csv" className="btn-primary">
            Download CSV
          </button>
          <button type="submit" name="format" value="xlsx" className="rounded-md border border-[var(--color-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper)]">
            Download XLSX
          </button>
        </div>
      </form>
    </div>
  );
}
