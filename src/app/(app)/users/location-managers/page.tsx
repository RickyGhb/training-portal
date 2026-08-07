import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter } from "@/lib/auth/rbac";
import { CreateStaffUserForm } from "@/components/users/CreateStaffUserForm";
import { UserTable, type UserRow } from "@/components/users/UserTable";

export default async function LocationManagersPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "CEO" && actor.role !== "MANAGER") redirect("/dashboard");

  const [locationManagers, locations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "LOCATION_MANAGER", deletedAt: null, ...userVisibilityFilter(actor) },
      orderBy: { createdAt: "desc" },
      include: { location: true },
    }),
    prisma.location.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

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
      <h1 className="text-2xl font-semibold text-slate-900">Location Managers</h1>
      <p className="mt-1 text-sm text-slate-500">Restricted to exactly one location each.</p>

      <div className="mt-6">
        <CreateStaffUserForm role="LOCATION_MANAGER" locationMode="required" locations={locations} />
      </div>

      <UserTable rows={rows} showLocation />
    </div>
  );
}
