import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter, canBulkReassign } from "@/lib/auth/rbac";
import { BulkReassignForm } from "./bulk-reassign-form";

export default async function BulkReassignPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (!canBulkReassign(actor.role)) redirect("/dashboard");

  const [consultants, coordinators] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CONSULTANT", deletedAt: null, ...userVisibilityFilter(actor) },
      orderBy: { firstName: "asc" },
      include: { coordinator: true },
    }),
    prisma.user.findMany({
      where: { role: "COORDINATOR", status: "ACTIVE", deletedAt: null, ...userVisibilityFilter(actor) },
      orderBy: { firstName: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Bulk reassign consultants</h1>
      <p className="mt-1 text-sm text-slate-500">
        Select consultants and move them all to a different coordinator at once.
      </p>

      <div className="mt-6">
        <BulkReassignForm
          consultants={consultants.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            username: c.username,
            coordinatorName: c.coordinator ? `${c.coordinator.firstName} ${c.coordinator.lastName}` : "—",
          }))}
          coordinators={coordinators}
        />
      </div>
    </div>
  );
}
