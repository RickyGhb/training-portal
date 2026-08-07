"use client";

import { useActionState } from "react";
import { createLocationAction } from "./actions";

export function LocationForm() {
  const [state, formAction, pending] = useActionState(createLocationAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 card">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Name</label>
        <input
          name="name"
          required
          className="w-48 field"
          placeholder="Dallas Office"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Code</label>
        <input
          name="code"
          required
          className="w-32 field"
          placeholder="DAL"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary disabled:opacity-50"
      >
        {pending ? "Creating..." : "Add location"}
      </button>
      {state.error && <p className="w-full text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
