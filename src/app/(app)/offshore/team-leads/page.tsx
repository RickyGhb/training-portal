import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { creatableRoles } from "@/lib/auth/rbac";
import { OFFSHORE_OFFICE_LABELS } from "@/lib/offshoreOfficeLabels";
import { StatusBadge } from "@/components/ui/Badge";
import { CreateUserForm } from "@/components/users/CreateUserForm";
import { UserRowActions } from "@/components/users/UserRowActions";
import type { OffshoreOffice } from "@/generated/prisma/client";
import { ReassignOfficeForm } from "./ReassignOfficeForm";

export default async function OffshoreTeamLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "CEO" && actor.role !== "OFFSHORE_MANAGER") redirect("/dashboard");

  const isCeo = actor.role === "CEO";
  const sp = await searchParams;

  const office: OffshoreOffice | null = isCeo
    ? typeof sp.office === "string" && (sp.office === "LOCATION_1" || sp.office === "LOCATION_2")
      ? sp.office
      : null
    : actor.offshoreOffice;

  const teamLeads = office
    ? await prisma.user.findMany({
        where: { role: "OFFSHORE_TEAM_LEAD", offshoreOffice: office, deletedAt: null },
        include: { _count: { select: { managedByTeamLead: true } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];

  return (
    <div>
      <h1 className="page-title">Offshore Team Leads</h1>
      <p className="page-subtitle">
        {isCeo ? "Pick an office to see its Team Leads." : "Team Leads in your office."}
      </p>

      {isCeo && (
        <form method="GET" className="mt-6 flex flex-wrap items-end gap-3 card">
          <div>
            <label htmlFor="office-filter" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Office
            </label>
            <select id="office-filter" name="office" defaultValue={office ?? ""} className="w-48 field">
              <option value="">Select an office</option>
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

      {!isCeo && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Create a Team Lead
          </h2>
          <div className="mt-3">
            <CreateUserForm allowedRoles={creatableRoles(actor.role)} actorRole={actor.role} locations={[]} coordinators={[]} />
          </div>
        </div>
      )}

      {!office ? (
        <p className="mt-8 text-sm text-[var(--color-ink-faint)]">Select an office above to see its Team Leads.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Consultants assigned</th>
                {isCeo && <th className="px-4 py-2">Move office</th>}
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {teamLeads.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 font-medium text-[var(--color-ink)]">
                    {t.firstName} {t.lastName}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">{t.username}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">{t._count.managedByTeamLead}</td>
                  {isCeo && (
                    <td className="px-4 py-2">
                      <ReassignOfficeForm teamLeadId={t.id} currentOffice={t.offshoreOffice} />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <UserRowActions
                      userId={t.id}
                      username={t.username}
                      fullName={`${t.firstName} ${t.lastName}`}
                      status={t.status}
                      isSelf={t.id === actor.id}
                    />
                  </td>
                </tr>
              ))}
              {teamLeads.length === 0 && (
                <tr>
                  <td colSpan={isCeo ? 6 : 5} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                    No Team Leads in this office yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
