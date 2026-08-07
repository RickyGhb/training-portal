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
}: {
  rows: UserRow[];
  showLocation?: boolean;
  showCoordinator?: boolean;
  /** Adds a link to the consultant's training-path/progress management page. */
  showLearningLink?: boolean;
}) {
  return (
    <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
      <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
        <tr>
          <th className="px-4 py-2">Name</th>
          <th className="px-4 py-2">Username</th>
          <th className="px-4 py-2">Contact</th>
          {showLocation && <th className="px-4 py-2">Location</th>}
          {showCoordinator && <th className="px-4 py-2">Coordinator</th>}
          <th className="px-4 py-2">Status</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-2 font-medium text-slate-900">
              {u.firstName} {u.lastName}
            </td>
            <td className="px-4 py-2 text-slate-600">{u.username}</td>
            <td className="px-4 py-2 text-slate-600">
              {u.email && <div>{u.email}</div>}
              {u.phone && <div>{u.phone}</div>}
            </td>
            {showLocation && <td className="px-4 py-2 text-slate-600">{u.locationName ?? "—"}</td>}
            {showCoordinator && <td className="px-4 py-2 text-slate-600">{u.coordinatorName ?? "—"}</td>}
            <td className="px-4 py-2">
              <StatusBadge status={u.status} />
            </td>
            <td className="px-4 py-2">
              <div className="flex items-center justify-end gap-3">
                {showLearningLink && u.status !== "DELETED" && (
                  <Link href={`/users/consultants/${u.id}`} className="text-sm font-medium text-slate-700 hover:text-slate-900">
                    Training &amp; progress
                  </Link>
                )}
                <UserRowActions
                  userId={u.id}
                  username={u.username}
                  fullName={`${u.firstName} ${u.lastName}`}
                  status={u.status}
                />
              </div>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
              No accounts yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
