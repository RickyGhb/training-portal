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
      <h1 className="text-2xl font-semibold text-slate-900">Audit Logs</h1>
      <p className="mt-1 text-sm text-slate-500">Every sensitive action across the portal, in one place. CEO only.</p>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Action type</label>
          <select name="actionType" defaultValue={actionType ?? ""} className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">All</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">From</label>
          <input type="date" name="from" defaultValue={typeof sp.from === "string" ? sp.from : ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">To</label>
          <input type="date" name="to" defaultValue={typeof sp.to === "string" ? sp.to : ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Apply
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{e.createdAt.toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-600">{e.actor ? `${e.actor.firstName} ${e.actor.lastName} (${e.actor.username})` : "System"}</td>
                <td className="px-4 py-2 font-medium text-slate-900">{e.actionType}</td>
                <td className="px-4 py-2 text-slate-600">
                  {e.targetUser ? `${e.targetUser.firstName} ${e.targetUser.lastName} (${e.targetUser.username})` : e.targetEntityType}
                </td>
                <td className="px-4 py-2 text-slate-600">{e.location?.name ?? "—"}</td>
                <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-500">
                  {e.metadataJson ? JSON.stringify(e.metadataJson) : ""}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No audit entries match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {totalPages} ({total} entries)
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <a href={qs({ page: page - 1 })} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
              ← Previous
            </a>
          )}
          {page < totalPages && (
            <a href={qs({ page: page + 1 })} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
              Next →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
