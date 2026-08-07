"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/app/(app)/users/actions";

type FormModalButtonProps = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  hiddenFields?: Record<string, string>;
  title: string;
  description?: string;
  submitLabel?: string;
  label: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Like ConfirmButton, but the modal contains real form fields (e.g. a new
 * username or password) instead of just a yes/no confirmation.
 */
export function FormModalButton({
  action,
  hiddenFields,
  title,
  description,
  submitLabel = "Save",
  label,
  children,
  className,
}: FormModalButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        className={className ?? "link-action"}
      >
        {label}
      </button>

      {open && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{description}</p>}
            <form action={handleSubmit} className="mt-4 space-y-3">
              {hiddenFields &&
                Object.entries(hiddenFields).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
              {children}
              {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="btn-primary">
                  {pending ? "Saving..." : submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
