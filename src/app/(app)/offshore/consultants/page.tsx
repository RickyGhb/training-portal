import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { OFFSHORE_OFFICE_LABELS } from "@/lib/offshoreOfficeLabels";
import { VISA_TYPE_LABELS } from "@/lib/visaTypeLabels";
import { StatusBadge } from "@/components/ui/Badge";
import type { OffshoreOffice } from "@/generated/prisma/client";
import { TeamLeadAssignSelect } from "./TeamLeadAssignSelect";

export default async function OffshoreConsultantsPage({
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

  const managerId = isCeo && typeof sp.managerId === "string" && sp.managerId ? sp.managerId : "";

  const [managersInOffice, teamLeads, consultants] = await Promise.all([
    isCeo && office
      ? prisma.user.findMany({
          where: { role: "OFFSHORE_MANAGER", offshoreOffice: office, deletedAt: null },
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
    !isCeo && office
      ? prisma.user.findMany({
          where: { role: "OFFSHORE_TEAM_LEAD", offshoreOffice: office, deletedAt: null, status: "ACTIVE" },
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
    office
      ? prisma.user.findMany({
          where: { role: "CONSULTANT", offshoreOffice: office, deletedAt: null },
          include: { offshoreTeamLead: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Consultant Data</h1>
          <p className="page-subtitle">
            {isCeo
              ? "Pick an office to see its consultants, optionally filtered to one Offshore Manager."
              : `${OFFSHORE_OFFICE_LABELS[actor.offshoreOffice as OffshoreOffice] ?? "Your office"} — your consultants.`}
          </p>
        </div>
        {isCeo && (
          <Link href="/offshore/team-leads" className="btn-secondary">
            Manage Team Leads
          </Link>
        )}
      </div>

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
          <div>
            <label htmlFor="manager-filter" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Offshore Manager
            </label>
            <select id="manager-filter" name="managerId" defaultValue={managerId} className="w-56 field">
              <option value="">All managers in this office</option>
              {managersInOffice.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
      )}

      {!office ? (
        <p className="mt-8 text-sm text-[var(--color-ink-faint)]">Select an office above to see its consultants.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Technology</th>
                <th className="px-4 py-2">Visa Type</th>
                <th className="px-4 py-2">Date of Birth</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Team Lead</th>
              </tr>
            </thead>
            <tbody>
              {consultants.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-[var(--color-ink)]">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">{c.username}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">{c.email ?? "—"}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">{c.phone ?? "—"}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">{c.technology ?? "—"}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                    {c.visaType ? VISA_TYPE_LABELS[c.visaType] : "—"}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                    {c.dateOfBirth ? c.dateOfBirth.toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                    {isCeo ? (
                      c.offshoreTeamLead ? `${c.offshoreTeamLead.firstName} ${c.offshoreTeamLead.lastName}` : "—"
                    ) : (
                      <TeamLeadAssignSelect
                        consultantId={c.id}
                        currentTeamLeadId={c.offshoreTeamLeadId}
                        teamLeads={teamLeads.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` }))}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {consultants.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                    No consultants in this office.
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
