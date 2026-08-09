"use client";

import { useActionState } from "react";
import { submitTrainerFeedbackAction } from "@/app/(app)/trainer/actions";

export function TrainerFeedbackForm({ consultantUserId }: { consultantUserId: string }) {
  const [state, formAction, pending] = useActionState(submitTrainerFeedbackAction, {});

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="consultantUserId" value={consultantUserId} />
      <div>
        <label htmlFor={`verdict-${consultantUserId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Verdict
        </label>
        <select id={`verdict-${consultantUserId}`} name="verdict" required defaultValue="" className="field py-1 text-sm">
          <option value="" disabled>
            Select
          </option>
          <option value="READY">Good to go with marketing</option>
          <option value="NOT_READY">Not yet</option>
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor={`notes-${consultantUserId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Notes (optional)
        </label>
        <input id={`notes-${consultantUserId}`} name="notes" className="w-full field py-1 text-sm" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary py-1 text-sm disabled:opacity-50">
        {pending ? "Submitting..." : "Submit feedback"}
      </button>
      {state.error && <p className="w-full text-xs text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-green-700">{state.success}</p>}
    </form>
  );
}
