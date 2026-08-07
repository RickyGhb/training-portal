import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter } from "@/lib/auth/rbac";
import { CreateConsultantForm } from "@/components/users/CreateConsultantForm";
import { UserTable, type UserRow } from "@/components/users/UserTable";

export default async function ConsultantsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role === "CONSULTANT") redirect("/dashboard");

  const consultantFilter =
    actor.role === "COORDINATOR" ? { coordinatorId: actor.id } : userVisibilityFilter(actor);

  const [consultants, coordinators] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CONSULTANT", deletedAt: null, ...consultantFilter },
      orderBy: { createdAt: "desc" },
      include: { location: true, coordinator: true },
    }),
    prisma.user.findMany({
      where:
        actor.role === "COORDINATOR"
          ? { id: actor.id }
          : { role: "COORDINATOR", status: "ACTIVE", deletedAt: null, ...userVisibilityFilter(actor) },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const rows: UserRow[] = consultants.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    email: u.email,
    phone: u.phone,
    status: u.status,
    locationName: u.location?.name,
    coordinatorName: u.coordinator ? `${u.coordinator.firstName} ${u.coordinator.lastName}` : undefined,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Consultants</h1>
      <p className="mt-1 text-sm text-slate-500">
        End learners. Each consultant is owned by exactly one coordinator.
      </p>

      <div className="mt-6">
        <CreateConsultantForm coordinators={coordinators} />
      </div>

      <UserTable rows={rows} showLocation showCoordinator />
    </div>
  );
}
