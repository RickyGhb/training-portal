import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { navItemsForRole } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { logoutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const navItems = navItemsForRole(user.role);
  const unreadNotifications =
    user.role === "CEO"
      ? await prisma.notification.count({ where: { recipientUserId: user.id, isRead: false } })
      : user.role === "COORDINATOR"
        ? await prisma.notification.count({
            where: { recipientUserId: user.id, isRead: false, type: "PROFILE_CHANGE_REQUESTED" },
          })
        : 0;

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex min-h-screen bg-[var(--color-paper)]">
      <aside className="flex w-64 shrink-0 flex-col bg-[var(--color-shell)] text-[var(--color-shell-text)]">
        <div className="border-b border-[var(--color-shell-border)] px-5 py-5">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-accent-soft)]">
            CrewNex
          </p>
          <Link
            href="/profile"
            className="mt-3 flex items-center gap-2.5 rounded-lg -mx-1 px-1 py-1 transition-colors hover:bg-white/[0.06]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-[#fff9f0]">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-shell-text)]">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-[var(--color-shell-text-muted)]">{ROLE_LABELS[user.role]}</p>
            </div>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {navItems.map((item) =>
            item.enabled ? (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--color-shell-text)]/90 transition-colors hover:bg-white/[0.06] hover:text-[var(--color-shell-text)]"
              >
                {item.label}
                {(item.href === "/notifications" || item.href === "/profile-requests") && unreadNotifications > 0 && (
                  <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-xs font-medium text-[#fff9f0]">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            ) : (
              <span
                key={item.href}
                title="Coming in a later build phase"
                className="cursor-not-allowed rounded-lg px-3 py-2 text-sm text-[var(--color-shell-text-muted)]/50"
              >
                {item.label}
              </span>
            )
          )}
        </nav>
        <div className="border-t border-[var(--color-shell-border)] p-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-shell-text)]/80 transition-colors hover:bg-white/[0.06] hover:text-[var(--color-shell-text)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
