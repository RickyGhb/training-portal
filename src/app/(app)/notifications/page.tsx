import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isCeo } from "@/lib/auth/rbac";
import { markNotificationReadAction, markAllNotificationsReadAction } from "./actions";

export default async function NotificationsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (!isCeo(actor.role)) redirect("/dashboard");

  const notifications = await prisma.notification.findMany({
    where: { recipientUserId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="field text-[var(--color-ink)] hover:bg-[var(--color-paper)]">
              Mark all as read
            </button>
          </form>
        )}
      </div>

      <ul className="mt-6  rounded-lg border border-[var(--color-border)] bg-white">
        {notifications.map((n) => (
          <li key={n.id} className={`flex items-start justify-between gap-4 px-4 py-3 ${n.isRead ? "" : "bg-blue-50/50"}`}>
            <div>
              <p className={`text-sm ${n.isRead ? "text-[var(--color-ink)]" : "font-semibold text-[var(--color-ink)]"}`}>{n.title}</p>
              <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{n.body}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{n.createdAt.toLocaleString()}</p>
            </div>
            {!n.isRead && (
              <form action={markNotificationReadAction}>
                <input type="hidden" name="notificationId" value={n.id} />
                <button type="submit" className="whitespace-nowrap text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                  Mark read
                </button>
              </form>
            )}
          </li>
        ))}
        {notifications.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-[var(--color-ink-faint)]">No notifications yet.</li>
        )}
      </ul>
    </div>
  );
}
