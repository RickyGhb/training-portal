import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { LocationForm } from "./location-form";
import { setLocationStatusAction } from "./actions";

export default async function LocationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CEO") redirect("/dashboard");

  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Locations</h1>
      <p className="mt-1 text-sm text-slate-500">Business units / branches. Only the CEO can create these.</p>

      <div className="mt-6">
        <LocationForm />
      </div>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Code</th>
            <th className="px-4 py-2">Users</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {locations.map((loc) => (
            <tr key={loc.id}>
              <td className="px-4 py-2 font-medium text-slate-900">{loc.name}</td>
              <td className="px-4 py-2 text-slate-600">{loc.code}</td>
              <td className="px-4 py-2 text-slate-600">{loc._count.users}</td>
              <td className="px-4 py-2">
                <StatusBadge status={loc.status} />
              </td>
              <td className="px-4 py-2 text-right">
                <ConfirmButton
                  action={setLocationStatusAction}
                  hiddenFields={{
                    locationId: loc.id,
                    nextStatus: loc.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
                  }}
                  confirmTitle={loc.status === "ACTIVE" ? "Archive location?" : "Reactivate location?"}
                  confirmMessage={
                    loc.status === "ACTIVE"
                      ? `Archiving "${loc.name}" removes it from active selection lists.`
                      : `"${loc.name}" will become selectable again.`
                  }
                  label={loc.status === "ACTIVE" ? "Archive" : "Reactivate"}
                />
              </td>
            </tr>
          ))}
          {locations.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                No locations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
