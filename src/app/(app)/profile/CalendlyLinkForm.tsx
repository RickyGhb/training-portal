"use client";

import { useActionState } from "react";
import { updateCalendlyLinkAction } from "@/app/(app)/users/actions";

export function CalendlyLinkForm({ calendlyLink }: { calendlyLink: string | null }) {
  const [state, formAction, pending] = useActionState(updateCalendlyLinkAction, {});

  return (
    <form action={formAction} className="mt-4 max-w-md card">
      <label htmlFor="calendlyLink" className="mb-1 block text-sm font-medium text-[var(--color-ink)]">
        Calendly link
      </label>
      <p className="mb-2 text-xs text-[var(--color-ink-soft)]">
        Consultants use this link to book their demo slot with you.
      </p>
      <input
        id="calendlyLink"
        name="calendlyLink"
        type="url"
        placeholder="https://calendly.com/your-name"
        defaultValue={calendlyLink ?? ""}
        className="w-full field"
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-secondary disabled:opacity-50">
          {pending ? "Saving..." : "Save"}
        </button>
        {state.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">{state.success}</p>}
      </div>
    </form>
  );
}
