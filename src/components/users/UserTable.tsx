import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { UserRowActions } from "@/components/users/UserRowActions";

export type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  phone: string | null;
  status: "ACTIVE" | "DEACTIVATED" | "DELETED";
  locationName?: string | null;
  coordinatorName?: string | null;
};

export function UserTable({
  rows,
  showLocation,
  showCoordinator,
  showLearningLink,
  currentUserId,
}: {
  rows: UserRow[];
  showLocation?: boolean;
  showCoordinator?: boolean;
  /** Adds a link to the consultant's training-path/progress management page. */
  showLearningLink?: boolean;
  /** The logged-in actor's own id — hides deactivate/delete on their own row. */
  currentUserId?: string;
}) {
  return (
    <table className="table-shell mt-6">
      <thead>
        <tr>
          <th>Name</th>
          <th>Username</th>
          <th>Contact</th>
          {showLocation && <th>Location</th>}
          {showCoordinator && <th>Coordinator</th>}
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => (
          <tr key={u.id}>
            <td className="font-medium text-[var(--color-ink)]">
              {u.firstName} {u.lastName}
            </td>
            <td className="text-[var(--color-ink-soft)]">{u.username}</td>
            <td className="text-[var(--color-ink-soft)]">
              {u.email && <div>{u.email}</div>}
              {u.phone && <div>{u.phone}</div>}
            </td>
            {showLocation && <td className="text-[var(--color-ink-soft)]">{u.locationName ?? "—"}</td>}
            {showCoordinator && <td className="text-[var(--color-ink-soft)]">{u.coordinatorName ?? "—"}</td>}
            <td>
              <StatusBadge status={u.status} />
            </td>
            <td>
              <div className="flex items-center justify-end gap-3">
                {showLearningLink && u.status !== "DELETED" && (
                  <Link href={`/users/consultants/${u.id}`} className="link-action">
                    Training &amp; progress
                  </Link>
                )}
                <UserRowActions
                  userId={u.id}
                  username={u.username}
                  fullName={`${u.firstName} ${u.lastName}`}
                  status={u.status}
                  isSelf={u.id === currentUserId}
                />
              </div>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="py-6 text-center text-[var(--color-ink-faint)]">
              No accounts yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
