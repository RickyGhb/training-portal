"use client";

import { useRef, useState, useTransition } from "react";

type ConfirmButtonProps = {
  action: (formData: FormData) => Promise<{ error?: string } | void> | void;
  hiddenFields?: Record<string, string>;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  label: string;
  variant?: "danger" | "default";
  className?: string;
};

/**
 * A button that opens a confirmation modal before submitting its form action.
 * Used for every destructive/high-impact action per the product spec
 * (delete, deactivate, change training path, bulk reassign, etc).
 *
 * Passing `action`: a Server Action is only registered for a route if some
 * *client* component in that route's own module graph imports it. Handing one
 * straight from a Server Component to this one is fine when a sibling client
 * component on the same route already imports that actions module (as
 * locations/page.tsx does — location-form.tsx imports ./actions), but on a
 * route where nothing else does, the action is never registered and every
 * submit fails at runtime with "Failed to find Server Action" (verified in a
 * production build, A/B'd against a clean rebuild). The reliable pattern is a
 * small "use client" wrapper that imports the action itself — see
 * forms/[id]/submissions/delete-submission-button.tsx.
 */
export function ConfirmButton({
  action,
  hiddenFields,
  confirmTitle,
  confirmMessage,
  confirmLabel = "Confirm",
  label,
  variant = "default",
  className,
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const buttonClasses = variant === "danger" ? "link-danger" : "link-action";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        className={className ?? buttonClasses}
      >
        {label}
      </button>

      {open && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
              {confirmTitle}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{confirmMessage}</p>
            <form
              ref={formRef}
              action={(formData) => {
                startTransition(async () => {
                  const result = await action(formData);
                  if (result?.error) {
                    setError(result.error);
                  } else {
                    setError(undefined);
                    setOpen(false);
                  }
                });
              }}
            >
              {hiddenFields &&
                Object.entries(hiddenFields).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
              {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={
                    variant === "danger"
                      ? "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-danger)] px-4 py-1.5 text-sm font-semibold text-[#fff9f0] transition-colors hover:bg-[#7d2a21] disabled:opacity-50"
                      : "btn-primary"
                  }
                >
                  {pending ? "Working..." : confirmLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
