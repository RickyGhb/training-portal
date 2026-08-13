"use client";

import { useActionState } from "react";
import { createTrainingPathAction } from "./actions";
import { TECHNOLOGY_OPTIONS } from "@/lib/technologyOptions";

export function TrainingPathForm() {
  const [state, formAction, pending] = useActionState(createTrainingPathAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 card">
      <div>
        <label htmlFor="training-path-name" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Name
        </label>
        <input
          id="training-path-name"
          name="name"
          required
          className="w-56 field"
          placeholder="New Consultant Onboarding"
        />
      </div>
      <div className="flex-1 min-w-[16rem]">
        <label htmlFor="training-path-description" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Description
        </label>
        <input
          id="training-path-description"
          name="description"
          className="w-full field"
          placeholder="Optional"
        />
      </div>
      <div>
        <label htmlFor="training-path-technology" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Technology
        </label>
        <select id="training-path-technology" name="technology" defaultValue="" className="w-56 field">
          <option value="">— General (no technology) —</option>
          {TECHNOLOGY_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.value}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary disabled:opacity-50"
      >
        {pending ? "Creating..." : "Add training path"}
      </button>
      {state.error && <p className="w-full text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
