"use client";

import { useRef, useState, useTransition } from "react";

type ConfirmButtonProps = {
  action: (formData: FormData) => Promise<void> | void;
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
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const buttonClasses = variant === "danger" ? "link-danger" : "link-action";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
                  await action(formData);
                  setOpen(false);
                });
              }}
            >
              {hiddenFields &&
                Object.entries(hiddenFields).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
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
