"use client";

import { useActionState } from "react";
import { submitOtterFeedbackAction } from "@/app/(app)/otter/actions";

export function OtterFeedbackForm({ consultantUserId }: { consultantUserId: string }) {
  const [state, formAction, pending] = useActionState(submitOtterFeedbackAction, {});

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="consultantUserId" value={consultantUserId} />
      <div>
        <label htmlFor={`overdict-${consultantUserId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Verdict
        </label>
        <select id={`overdict-${consultantUserId}`} name="verdict" required defaultValue="" className="field py-1 text-sm">
          <option value="" disabled>
            Select
          </option>
          <option value="READY">Ready for marketing</option>
          <option value="NOT_READY">Not yet</option>
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor={`onotes-${consultantUserId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Notes (optional)
        </label>
        <input id={`onotes-${consultantUserId}`} name="notes" className="w-full field py-1 text-sm" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary py-1 text-sm disabled:opacity-50">
        {pending ? "Submitting..." : "Submit feedback"}
      </button>
      {state.error && <p className="w-full text-xs text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-green-700">{state.success}</p>}
    </form>
  );
}
