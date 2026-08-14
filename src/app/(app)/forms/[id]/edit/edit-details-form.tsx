"use client";

import { useActionState } from "react";
import { updateFormAction } from "../../actions";

export function EditDetailsForm({
  formId,
  title,
  description,
}: {
  formId: string;
  title: string;
  description: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateFormAction, {});

  return (
    <form action={formAction} className="card">
      <input type="hidden" name="formId" value={formId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-form-title" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Title
          </label>
          <input id="edit-form-title" name="title" required defaultValue={title} className="w-full field" />
        </div>
        <div>
          <label htmlFor="edit-form-description" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Description
          </label>
          <input
            id="edit-form-description"
            name="description"
            defaultValue={description ?? ""}
            className="w-full field"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-secondary disabled:opacity-50">
          {pending ? "Saving..." : "Save details"}
        </button>
        {state.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">{state.success}</p>}
      </div>
    </form>
  );
}
