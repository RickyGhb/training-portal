import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user?.firstName}</h1>
      <p className="mt-2 text-sm text-slate-500">
        This dashboard will fill in with role-specific reporting in Phase 5. For now, this
        confirms your login and role-based access are working end to end.
      </p>
    </div>
  );
}
