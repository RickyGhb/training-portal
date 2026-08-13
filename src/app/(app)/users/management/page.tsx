import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma, Role } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userVisibilityFilter, canBulkReassign } from "@/lib/auth/rbac";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { OFFSHORE_OFFICE_LABELS } from "@/lib/offshoreOfficeLabels";
import { VISA_TYPE_LABELS } from "@/lib/visaTypeLabels";
import { StatusBadge } from "@/components/ui/Badge";
import { UserRowActions } from "@/components/users/UserRowActions";

const ALL_ROLES: Role[] = [
  "CEO",
  "LOCATION_MANAGER",
  "LOCATION_ADMIN",
  "COORDINATOR",
  "CONSULTANT",
  "OFFSHORE_MANAGER",
  "OFFSHORE_TEAM_LEAD",
  "TRAINER",
  "OTTER_TEAM",
];

/** Roles visible to this actor at all, derived from the same scope rule as userVisibilityFilter, for populating the role filter dropdown. */
function visibleRolesFor(actorRole: Role): Role[] {
  switch (actorRole) {
    case "CEO":
      return ALL_ROLES;
    case "LOCATION_MANAGER":
      return ["LOCATION_ADMIN", "COORDINATOR", "CONSULTANT"];
    case "LOCATION_ADMIN":
      return ["COORDINATOR", "CONSULTANT"];
    case "COORDINATOR":
      return ["CONSULTANT"];
    default:
      return [];
  }
}

const PAGE_SIZE = 25;

export default async function UserManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  // These roles sit outside the location hierarchy this page is built around
  // (userVisibilityFilter/visibleRolesFor have no case for them, so they'd
  // otherwise land on an empty, pointless "User Management" page) — each has
  // its own dedicated list page instead.
  if (
    actor.role === "CONSULTANT" ||
    actor.role === "OFFSHORE_MANAGER" ||
    actor.role === "OFFSHORE_TEAM_LEAD" ||
    actor.role === "TRAINER" ||
    actor.role === "OTTER_TEAM"
  ) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const visibleRoles = visibleRolesFor(actor.role);
  const roleFilter =
    typeof sp.role === "string" && visibleRoles.includes(sp.role as Role) ? (sp.role as Role) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, typeof sp.page === "string" ? parseInt(sp.page, 10) || 1 : 1);

  // Matched word-by-word (AND across words, OR across fields per word) so a
  // full-name search like "Taylor Brooks" matches even though firstName and
  // lastName are separate columns — a single `contains` check against the
  // whole query string would never match either field on its own.
  const searchWords = q.split(/\s+/).filter(Boolean);
  const wordClause = (word: string): Prisma.UserWhereInput => ({
    OR: [
      { firstName: { contains: word, mode: "insensitive" } },
      { lastName: { contains: word, mode: "insensitive" } },
      { username: { contains: word, mode: "insensitive" } },
      { location: { name: { contains: word, mode: "insensitive" } } },
      {
        coordinator: {
          OR: [
            { firstName: { contains: word, mode: "insensitive" } },
            { lastName: { contains: word, mode: "insensitive" } },
          ],
        },
      },
      {
        locationManager: {
          OR: [
            { firstName: { contains: word, mode: "insensitive" } },
            { lastName: { contains: word, mode: "insensitive" } },
          ],
        },
      },
      {
        manager: {
          OR: [
            { firstName: { contains: word, mode: "insensitive" } },
            { lastName: { contains: word, mode: "insensitive" } },
          ],
        },
      },
    ],
  });
  const searchClause: Prisma.UserWhereInput = searchWords.length > 0 ? { AND: searchWords.map(wordClause) } : {};

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...userVisibilityFilter(actor),
    role: roleFilter ?? { in: visibleRoles },
    AND: [searchClause],
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { location: true, coordinator: true, locationManager: true, manager: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showConsultantColumns = roleFilter === "CONSULTANT";

  const baseParams = new URLSearchParams();
  if (roleFilter) baseParams.set("role", roleFilter);
  if (q) baseParams.set("q", q);

  const pageHref = (p: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(p));
    return `/users/management?${params.toString()}`;
  };

  return (
    <div>
      <h1 className="page-title">User Management</h1>
      <p className="page-subtitle">
        {actor.role === "COORDINATOR" ? "Your consultants only." : "Scoped to what you can manage."}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/users/new" className="btn-primary">
          Create User
        </Link>
        {canBulkReassign(actor.role) && (
          <Link href="/users/bulk-reassign" className="btn-secondary">
            Bulk Reassignment
          </Link>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
          View / Filter Users
        </h2>

        <form method="GET" className="mt-3 flex flex-wrap items-end gap-3 card">
          <div>
            <label htmlFor="role-filter" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Role
            </label>
            <select id="role-filter" name="role" defaultValue={roleFilter ?? ""} className="w-48 field">
              <option value="">All</option>
              {visibleRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="user-search" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Search
            </label>
            <input
              id="user-search"
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Name, username, location, coordinator, manager..."
              className="w-72 field"
            />
          </div>
          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>

        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Reports to</th>
                <th className="px-4 py-2">Status</th>
                {showConsultantColumns && (
                  <>
                    <th className="px-4 py-2">Offshore Office</th>
                    <th className="px-4 py-2">Technology</th>
                    <th className="px-4 py-2">Visa Type</th>
                    <th className="px-4 py-2">Date of Birth</th>
                  </>
                )}
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const reportsTo = u.coordinator ?? u.locationManager ?? u.manager;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-2 font-medium text-[var(--color-ink)]">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">{u.username}</td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">{u.location?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                      {reportsTo ? `${reportsTo.firstName} ${reportsTo.lastName}` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={u.status} />
                    </td>
                    {showConsultantColumns && (
                      <>
                        <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                          {u.offshoreOffice ? OFFSHORE_OFFICE_LABELS[u.offshoreOffice] : "—"}
                        </td>
                        <td className="px-4 py-2 text-[var(--color-ink-soft)]">{u.technology ?? "—"}</td>
                        <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                          {u.visaType ? VISA_TYPE_LABELS[u.visaType] : "—"}
                        </td>
                        <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                          {u.dateOfBirth ? u.dateOfBirth.toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-3">
                        {u.role === "CONSULTANT" && u.status !== "DELETED" && (
                          <Link href={`/users/consultants/${u.id}`} className="link-action">
                            Training &amp; progress
                          </Link>
                        )}
                        <UserRowActions
                          userId={u.id}
                          username={u.username}
                          fullName={`${u.firstName} ${u.lastName}`}
                          status={u.status}
                          isSelf={u.id === actor.id}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={showConsultantColumns ? 11 : 7} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-ink-soft)]">
            <span>
              Page {page} of {totalPages} ({total} users)
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="link-action">
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={pageHref(page + 1)} className="link-action">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
