import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { UserTable, type UserRow } from "@/components/users/UserTable";

export default async function ManagersPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "CEO") redirect("/dashboard");

  const managers = await prisma.user.findMany({
    where: { role: "MANAGER", deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const rows: UserRow[] = managers.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    username: m.username,
    email: m.email,
    phone: m.phone,
    status: m.status,
  }));

  return (
    <div>
      <h1 className="page-title">Managers</h1>
      <p className="page-subtitle">Global operational role below CEO.</p>

      <UserTable rows={rows} currentUserId={actor.id} />
    </div>
  );
}
