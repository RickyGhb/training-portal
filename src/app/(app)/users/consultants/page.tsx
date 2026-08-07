import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter } from "@/lib/auth/rbac";
import { UserTable, type UserRow } from "@/components/users/UserTable";

export default async function ConsultantsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role === "CONSULTANT") redirect("/dashboard");

  const consultantFilter =
    actor.role === "COORDINATOR" ? { coordinatorId: actor.id } : userVisibilityFilter(actor);

  const consultants = await prisma.user.findMany({
    where: { role: "CONSULTANT", deletedAt: null, ...consultantFilter },
    orderBy: { createdAt: "desc" },
    include: { location: true, coordinator: true },
  });

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
      <h1 className="page-title">Consultants</h1>
      <p className="page-subtitle">
        End learners. Each consultant is owned by exactly one coordinator.
      </p>

      <UserTable rows={rows} showLocation showCoordinator showLearningLink currentUserId={actor.id} />
    </div>
  );
}
