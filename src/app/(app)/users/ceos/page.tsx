import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { UserTable, type UserRow } from "@/components/users/UserTable";

export default async function CeosPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "CEO") redirect("/dashboard");

  const ceos = await prisma.user.findMany({
    where: { role: "CEO", deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const rows: UserRow[] = ceos.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    email: u.email,
    phone: u.phone,
    status: u.status,
  }));

  return (
    <div>
      <h1 className="page-title">CEOs</h1>
      <p className="page-subtitle">
        Full-access accounts. Create a new one from the Create User page.
      </p>

      <UserTable rows={rows} currentUserId={actor.id} />
    </div>
  );
}
