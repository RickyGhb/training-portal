"use client";

import { useActionState } from "react";
import { updateConsultantVisaDobAction } from "@/app/(app)/users/actions";
import { VISA_TYPE_LABELS } from "@/lib/visaTypeLabels";
import type { VisaType } from "@/generated/prisma/client";

const todayStr = new Date().toISOString().slice(0, 10);

export function VisaDobForm({
  userId,
  visaType,
  dateOfBirth,
}: {
  userId: string;
  visaType: VisaType | null;
  dateOfBirth: Date | null;
}) {
  const [state, formAction, pending] = useActionState(updateConsultantVisaDobAction, {});

  return (
    <form action={formAction} className="mt-3 max-w-md space-y-3 card">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <label htmlFor={`visa-type-${userId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Visa Type
        </label>
        <select
          id={`visa-type-${userId}`}
          name="visaType"
          required
          defaultValue={visaType ?? ""}
          className="w-full field"
        >
          <option value="" disabled>
            Select a visa type
          </option>
          {Object.entries(VISA_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`dob-${userId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Date of Birth
        </label>
        <input
          id={`dob-${userId}`}
          name="dateOfBirth"
          type="date"
          required
          max={todayStr}
          defaultValue={dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : ""}
          className="w-full field"
        />
      </div>
      {state.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">{state.success}</p>}
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
