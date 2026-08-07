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
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Mark all as read
            </button>
          </form>
        )}
      </div>

      <ul className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {notifications.map((n) => (
          <li key={n.id} className={`flex items-start justify-between gap-4 px-4 py-3 ${n.isRead ? "" : "bg-blue-50/50"}`}>
            <div>
              <p className={`text-sm ${n.isRead ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
              <p className="mt-1 text-xs text-slate-400">{n.createdAt.toLocaleString()}</p>
            </div>
            {!n.isRead && (
              <form action={markNotificationReadAction}>
                <input type="hidden" name="notificationId" value={n.id} />
                <button type="submit" className="whitespace-nowrap text-xs font-medium text-slate-500 hover:text-slate-900">
                  Mark read
                </button>
              </form>
            )}
          </li>
        ))}
        {notifications.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</li>
        )}
      </ul>
    </div>
  );
}
