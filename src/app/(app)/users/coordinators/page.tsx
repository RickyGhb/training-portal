import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter } from "@/lib/auth/rbac";
import { CreateStaffUserForm } from "@/components/users/CreateStaffUserForm";
import { UserTable, type UserRow } from "@/components/users/UserTable";

export default async function CoordinatorsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "CEO" && actor.role !== "MANAGER" && actor.role !== "LOCATION_MANAGER") {
    redirect("/dashboard");
  }

  const [coordinators, locations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "COORDINATOR", deletedAt: null, ...userVisibilityFilter(actor) },
      orderBy: { createdAt: "desc" },
      include: { location: true },
    }),
    prisma.location.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

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

  // Only the CEO may leave a coordinator unattached to a location.
  const locationMode: "none" | "required" | "optional" =
    actor.role === "CEO" ? "optional" : actor.role === "LOCATION_MANAGER" ? "none" : "required";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Coordinators</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage consultants directly. Can operate independently of a location if created that way by the CEO.
      </p>

      <div className="mt-6">
        <CreateStaffUserForm role="COORDINATOR" locationMode={locationMode} locations={locations} />
      </div>

      <UserTable rows={rows} showLocation />
    </div>
  );
}
