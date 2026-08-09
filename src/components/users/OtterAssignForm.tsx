"use client";

import { useActionState } from "react";
import { assignOtterTeamAction } from "@/app/(app)/users/actions";

export function OtterAssignForm({
  userId,
  otterTeamUserId,
  otterTeamMembers,
}: {
  userId: string;
  otterTeamUserId: string | null;
  otterTeamMembers: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignOtterTeamAction, {});

  return (
    <form action={formAction} className="mt-3 flex max-w-md items-center justify-between card">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--color-ink)]">Otter Team reviewer</p>
        <select name="otterTeamUserId" defaultValue={otterTeamUserId ?? ""} disabled={pending} className="mt-1 w-full field">
          <option value="">Unassigned</option>
          {otterTeamMembers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {state.error && <p className="mt-1 text-xs text-[var(--color-danger)]">{state.error}</p>}
      </div>
      <button type="submit" disabled={pending} className="btn-secondary ml-3 disabled:opacity-50">
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
