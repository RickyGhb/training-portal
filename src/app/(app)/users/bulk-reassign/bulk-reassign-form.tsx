"use client";

import { useActionState, useState } from "react";
import { bulkReassignAction } from "@/app/(app)/users/actions";

type Consultant = { id: string; firstName: string; lastName: string; username: string; coordinatorName: string };
type Coordinator = { id: string; firstName: string; lastName: string };

export function BulkReassignForm({
  consultants,
  coordinators,
}: {
  consultants: Consultant[];
  coordinators: Coordinator[];
}) {
  const [state, formAction, pending] = useActionState(bulkReassignAction, {});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form
      action={(formData) => {
        setConfirmOpen(false);
        formAction(formData);
      }}
    >
      <div className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="w-10 px-4 py-2"></th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Current coordinator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {consultants.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    name="consultantIds"
                    value={c.id}
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                </td>
                <td className="px-4 py-2 font-medium text-slate-900">
                  {c.firstName} {c.lastName}
                </td>
                <td className="px-4 py-2 text-slate-600">{c.username}</td>
                <td className="px-4 py-2 text-slate-600">{c.coordinatorName}</td>
              </tr>
            ))}
            {consultants.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No consultants in scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Reassign selected to</label>
          <select
            name="newCoordinatorId"
            required
            className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Select a coordinator
            </option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>

        {!confirmOpen ? (
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setConfirmOpen(true)}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Reassign {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">
              Move {selected.size} consultant(s) to the selected coordinator?
            </span>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Reassigning..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="mt-2 text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
