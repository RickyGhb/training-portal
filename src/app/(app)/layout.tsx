import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { navItemsForRole } from "@/lib/nav";
import { logoutAction } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  CEO: "CEO",
  MANAGER: "Manager",
  LOCATION_MANAGER: "Location Manager",
  COORDINATOR: "Coordinator",
  CONSULTANT: "Consultant",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const navItems = navItemsForRole(user.role);
  const unreadNotifications =
    user.role === "CEO"
      ? await prisma.notification.count({ where: { recipientUserId: user.id, isRead: false } })
      : 0;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Training Portal</p>
          <p className="text-xs text-slate-500">
            {user.firstName} {user.lastName} · {ROLE_LABELS[user.role]}
          </p>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {navItems.map((item) =>
            item.enabled ? (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {item.label}
                {item.href === "/notifications" && unreadNotifications > 0 && (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            ) : (
              <span
                key={item.href}
                title="Coming in a later build phase"
                className="cursor-not-allowed rounded-md px-3 py-2 text-sm text-slate-400"
              >
                {item.label}
              </span>
            )
          )}
        </nav>
        <form action={logoutAction} className="border-t border-slate-200 p-2">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
