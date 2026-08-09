import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { markProfileRequestReadAction, markAllProfileRequestsReadAction } from "./actions";

export default async function ProfileRequestsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "COORDINATOR") redirect("/dashboard");

  const notifications = await prisma.notification.findMany({
    where: { recipientUserId: actor.id, type: "PROFILE_CHANGE_REQUESTED" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { sourceAuditLog: { select: { targetUserId: true } } },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Profile Requests</h1>
          <p className="page-subtitle">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllProfileRequestsReadAction}>
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
              {n.sourceAuditLog?.targetUserId && (
                <Link
                  href={`/users/consultants/${n.sourceAuditLog.targetUserId}`}
                  className="mt-1 inline-block text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  Open consultant profile to apply this change →
                </Link>
              )}
            </div>
            {!n.isRead && (
              <form action={markProfileRequestReadAction}>
                <input type="hidden" name="notificationId" value={n.id} />
                <button type="submit" className="whitespace-nowrap text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                  Mark read
                </button>
              </form>
            )}
          </li>
        ))}
        {notifications.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-[var(--color-ink-faint)]">No profile change requests yet.</li>
        )}
      </ul>
    </div>
  );
}
