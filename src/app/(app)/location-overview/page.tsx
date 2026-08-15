import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter } from "@/lib/auth/rbac";
import { OFFSHORE_OFFICE_LABELS } from "@/lib/offshoreOfficeLabels";
import { StatusBadge } from "@/components/ui/Badge";
import type { OffshoreOffice, Prisma } from "@/generated/prisma/client";

export default async function LocationOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role === "CONSULTANT") redirect("/dashboard");
  if (actor.role === "OFFSHORE_MANAGER" || actor.role === "OFFSHORE_TEAM_LEAD" || actor.role === "TRAINER" || actor.role === "OTTER_TEAM") {
    redirect("/dashboard");
  }

  const isCeo = actor.role === "CEO";
  const sp = await searchParams;
  const officeFilter: OffshoreOffice | null =
    isCeo && typeof sp.office === "string" && (sp.office === "LOCATION_1" || sp.office === "LOCATION_2") ? sp.office : null;

  const where: Prisma.UserWhereInput = {
    role: "CONSULTANT",
    deletedAt: null,
    ...userVisibilityFilter(actor),
    ...(officeFilter ? { offshoreOffice: officeFilter } : {}),
  };

  const consultants = await prisma.user.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      status: true,
      marketingStatus: true,
      offshoreOffice: true,
      location: { select: { name: true } },
      coordinator: { select: { firstName: true, lastName: true } },
    },
  });

  const inTraining = consultants.filter((c) => c.marketingStatus === "IN_TRAINING");
  const inMarketing = consultants.filter((c) => c.marketingStatus === "IN_MARKETING");

  return (
    <div>
      <h1 className="page-title">Location Overview</h1>
      <p className="page-subtitle">
        {actor.role === "COORDINATOR" ? "Your consultants, split by readiness." : "Scoped consultants, split by readiness."}
      </p>

      {isCeo && (
        <form method="GET" className="mt-6 flex flex-wrap items-end gap-3 card">
          <div>
            <label htmlFor="office-filter" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Office
            </label>
            <select id="office-filter" name="office" defaultValue={officeFilter ?? ""} className="w-48 field">
              <option value="">All offices</option>
              {Object.entries(OFFSHORE_OFFICE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="card">
          <div className="stat-number">{inTraining.length}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">In Training</div>
        </div>
        <div className="card">
          <div className="stat-number">{inMarketing.length}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">In Marketing</div>
        </div>
      </div>

      {[
        { label: "In Marketing", rows: inMarketing },
        { label: "In Training", rows: inTraining },
      ].map((group) => (
        <div key={group.label} className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{group.label}</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Username</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Coordinator</th>
                  <th className="px-4 py-2">Office</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-medium text-[var(--color-ink)]">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">{c.username}</td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">{c.location?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                      {c.coordinator ? `${c.coordinator.firstName} ${c.coordinator.lastName}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                      {c.offshoreOffice ? OFFSHORE_OFFICE_LABELS[c.offshoreOffice] : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
                {group.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                      No consultants here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
