"use client";

import { useActionState } from "react";
import { assignTrainerAction } from "@/app/(app)/users/actions";

export function TrainerAssignForm({
  userId,
  trainerUserId,
  trainers,
}: {
  userId: string;
  trainerUserId: string | null;
  trainers: { id: string; name: string; technology: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(assignTrainerAction, {});

  return (
    <form action={formAction} className="mt-3 flex max-w-md items-center justify-between card">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--color-ink)]">Trainer</p>
        <select name="trainerUserId" defaultValue={trainerUserId ?? ""} disabled={pending} className="mt-1 w-full field">
          <option value="">Unassigned</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.technology ? ` (${t.technology})` : ""}
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
