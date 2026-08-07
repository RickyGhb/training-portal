import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter } from "@/lib/auth/rbac";
import { UserTable, type UserRow } from "@/components/users/UserTable";

export default async function CoordinatorsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "CEO" && actor.role !== "MANAGER" && actor.role !== "LOCATION_MANAGER") {
    redirect("/dashboard");
  }

  const coordinators = await prisma.user.findMany({
    where: { role: "COORDINATOR", deletedAt: null, ...userVisibilityFilter(actor) },
    orderBy: { createdAt: "desc" },
    include: { location: true },
  });

  const rows: UserRow[] = coordinators.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    email: u.email,
    phone: u.phone,
    status: u.status,
    locationName: u.location?.name ?? "Independent",
  }));

  return (
    <div>
      <h1 className="page-title">Coordinators</h1>
      <p className="page-subtitle">
        Manage consultants directly. Can operate independently of a location if created that way by the CEO.
      </p>

      <UserTable rows={rows} showLocation currentUserId={actor.id} />
    </div>
  );
}
