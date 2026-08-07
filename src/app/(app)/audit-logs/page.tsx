import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isCeo } from "@/lib/auth/rbac";

const ACTION_TYPES = [
  "USER_CREATED",
  "USERNAME_CHANGED",
  "PASSWORD_RESET",
  "USER_DEACTIVATED",
  "USER_REACTIVATED",
  "USER_DELETED",
  "TRAINING_PATH_ASSIGNED",
  "TRAINING_PATH_CHANGED",
  "EXTRA_COURSE_ASSIGNED",
  "EXTRA_COURSE_REMOVED",
  "CONSULTANT_REASSIGNED",
  "CONSULTANTS_BULK_REASSIGNED",
  "LOCATION_CREATED",
  "LOCATION_UPDATED",
  "TRAINING_PATH_CREATED",
  "TRAINING_PATH_UPDATED",
  "TRAINING_PATH_DELETED",
  "COURSE_CREATED",
  "COURSE_UPDATED",
  "COURSE_DELETED",
  "VIDEO_CREATED",
  "VIDEO_UPDATED",
  "VIDEO_DELETED",
  "REPORT_EXPORTED",
  "LOGIN_SUCCEEDED",
  "LOGIN_FAILED",
] as const;

const PAGE_SIZE = 50;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (!isCeo(actor.role)) redirect("/dashboard");

  const sp = await searchParams;
  const actionType = typeof sp.actionType === "string" && sp.actionType ? sp.actionType : undefined;
  const from = typeof sp.from === "string" && sp.from ? new Date(sp.from) : undefined;
  const to = typeof sp.to === "string" && sp.to ? new Date(sp.to) : undefined;
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const where = {
    ...(actionType ? { actionType: actionType as (typeof ACTION_TYPES)[number] } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) } : {}),
          },
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        actor: { select: { firstName: true, lastName: true, username: true } },
        targetUser: { select: { firstName: true, lastName: true, username: true } },
        location: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    if (actionType) params.set("actionType", actionType);
    if (sp.from && typeof sp.from === "string") params.set("from", sp.from);
    if (sp.to && typeof sp.to === "string") params.set("to", sp.to);
    Object.entries(overrides).forEach(([k, v]) => params.set(k, String(v)));
    return `?${params.toString()}`;
  };

  return (
    <div>
      <h1 className="page-title">Audit Logs</h1>
      <p className="page-subtitle">Every sensitive action across the portal, in one place. CEO only.</p>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3 card">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Action type</label>
          <select name="actionType" defaultValue={actionType ?? ""} className="w-56 field">
            <option value="">All</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">From</label>
          <input type="date" name="from" defaultValue={typeof sp.from === "string" ? sp.from : ""} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">To</label>
          <input type="date" name="to" defaultValue={typeof sp.to === "string" ? sp.to : ""} className="field" />
        </div>
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
        <table className="w-full text-sm">
          <thead className="">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody className="">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-[var(--color-ink-soft)]">{e.createdAt.toLocaleString()}</td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">{e.actor ? `${e.actor.firstName} ${e.actor.lastName} (${e.actor.username})` : "System"}</td>
                <td className="px-4 py-2 font-medium text-[var(--color-ink)]">{e.actionType}</td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                  {e.targetUser ? `${e.targetUser.firstName} ${e.targetUser.lastName} (${e.targetUser.username})` : e.targetEntityType}
                </td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">{e.location?.name ?? "—"}</td>
                <td className="max-w-xs truncate px-4 py-2 text-xs text-[var(--color-ink-soft)]">
                  {e.metadataJson ? JSON.stringify(e.metadataJson) : ""}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                  No audit entries match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-ink-soft)]">
        <span>
          Page {page} of {totalPages} ({total} entries)
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <a href={qs({ page: page - 1 })} className="rounded-md border border-[var(--color-border)] px-3 py-1 hover:bg-[var(--color-paper)]">
              ← Previous
            </a>
          )}
          {page < totalPages && (
            <a href={qs({ page: page + 1 })} className="rounded-md border border-[var(--color-border)] px-3 py-1 hover:bg-[var(--color-paper)]">
              Next →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
