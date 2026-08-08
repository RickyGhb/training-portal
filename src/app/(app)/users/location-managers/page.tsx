import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter } from "@/lib/auth/rbac";
import { UserTable, type UserRow } from "@/components/users/UserTable";

export default async function LocationManagersPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "CEO" && actor.role !== "LOCATION_MANAGER") redirect("/dashboard");

  const locationManagers = await prisma.user.findMany({
    where: { role: "LOCATION_ADMIN", deletedAt: null, ...userVisibilityFilter(actor) },
    orderBy: { createdAt: "desc" },
    include: { location: true },
  });

  const rows: UserRow[] = locationManagers.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    email: u.email,
    phone: u.phone,
    status: u.status,
    locationName: u.location?.name,
  }));

  return (
    <div>
      <h1 className="page-title">Location Admins</h1>
      <p className="page-subtitle">Restricted to exactly one location each.</p>

      <UserTable rows={rows} showLocation currentUserId={actor.id} />
    </div>
  );
}
