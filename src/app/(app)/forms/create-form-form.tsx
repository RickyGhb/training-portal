"use client";

import { useActionState } from "react";
import { createFormAction } from "./actions";

export function CreateFormForm() {
  const [state, formAction, pending] = useActionState(createFormAction, {});

  return (
    <form action={formAction} className="card">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="form-title" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Title
          </label>
          <input id="form-title" name="title" required placeholder="Onboarding Form" className="w-full field" />
        </div>
        <div>
          <label htmlFor="form-description" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Description
          </label>
          <input id="form-description" name="description" placeholder="Optional" className="w-full field" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Creating..." : "Create form"}
        </button>
        {state.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      </div>
    </form>
  );
}
