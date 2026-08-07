import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter, creatableRoles } from "@/lib/auth/rbac";
import { CreateUserForm } from "@/components/users/CreateUserForm";

export default async function NewUserPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const allowedRoles = creatableRoles(actor.role);
  if (allowedRoles.length === 0) redirect("/dashboard");

  const needsLocations = allowedRoles.some((r) => r === "LOCATION_MANAGER" || r === "COORDINATOR");
  const needsCoordinators = allowedRoles.includes("CONSULTANT");

  const [locations, coordinators] = await Promise.all([
    needsLocations
      ? prisma.location.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    needsCoordinators
      ? actor.role === "COORDINATOR"
        ? prisma.user.findMany({ where: { id: actor.id } })
        : prisma.user.findMany({
            where: { role: "COORDINATOR", status: "ACTIVE", deletedAt: null, ...userVisibilityFilter(actor) },
            orderBy: { firstName: "asc" },
          })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="page-title">Create User</h1>
      <p className="page-subtitle">Pick an account type, then fill in the details for that role.</p>

      <div className="mt-6">
        <CreateUserForm
          allowedRoles={allowedRoles}
          actorRole={actor.role}
          locations={locations}
          coordinators={coordinators}
        />
      </div>
    </div>
  );
}
