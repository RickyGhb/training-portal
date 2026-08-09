"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { profileChangeRequestAction } from "@/app/(app)/users/actions";

const FIELD_OPTIONS = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "username", label: "Username" },
];

export function ProfileChangeRequestButton() {
  return (
    <FormModalButton
      action={profileChangeRequestAction}
      title="Request a profile change"
      description="Your coordinator will review this and update your account."
      submitLabel="Send request"
      label="Request a change"
    >
      <div>
        <label htmlFor="request-field" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          What would you like changed?
        </label>
        <select id="request-field" name="field" required className="w-full field">
          {FIELD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="request-desired-value" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          New value
        </label>
        <input id="request-desired-value" name="desiredValue" required className="w-full field" />
      </div>
      <div>
        <label htmlFor="request-note" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Note (optional)
        </label>
        <textarea id="request-note" name="note" rows={3} className="w-full field" />
      </div>
    </FormModalButton>
  );
}
