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
        className={className ?? "text-sm font-medium text-slate-700 hover:text-slate-900"}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
            <form action={handleSubmit} className="mt-4 space-y-3">
              {hiddenFields &&
                Object.entries(hiddenFields).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
              {children}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
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
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
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
