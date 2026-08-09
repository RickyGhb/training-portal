import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { VISA_TYPE_LABELS } from "@/lib/visaTypeLabels";
import { StatusBadge } from "@/components/ui/Badge";

export default async function OffshoreMyConsultantsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "OFFSHORE_TEAM_LEAD") redirect("/dashboard");

  const consultants = await prisma.user.findMany({
    where: { role: "CONSULTANT", offshoreTeamLeadId: actor.id, deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div>
      <h1 className="page-title">My Consultants</h1>
      <p className="page-subtitle">Consultants assigned to you by your Offshore Manager.</p>

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
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">{c.visaType ? VISA_TYPE_LABELS[c.visaType] : "—"}</td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                  {c.dateOfBirth ? c.dateOfBirth.toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
            {consultants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                  No consultants assigned to you yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
