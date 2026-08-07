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

  const buttonClasses =
    variant === "danger"
      ? "text-red-600 hover:text-red-700"
      : "text-slate-700 hover:text-slate-900";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? `text-sm font-medium ${buttonClasses}`}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-base font-semibold text-slate-900">{confirmTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">{confirmMessage}</p>
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
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                    variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
                  }`}
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
