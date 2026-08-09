"use client";

import { useActionState } from "react";
import { updateProfileFieldsAction } from "@/app/(app)/users/actions";

export function ProfileFieldsForm({
  userId,
  firstName,
  lastName,
  email,
  phone,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfileFieldsAction, {});

  return (
    <form action={formAction} className="mt-3 max-w-md space-y-3 card">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor={`profile-first-${userId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            First name
          </label>
          <input id={`profile-first-${userId}`} name="firstName" required defaultValue={firstName} className="w-full field" />
        </div>
        <div className="flex-1">
          <label htmlFor={`profile-last-${userId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Last name
          </label>
          <input id={`profile-last-${userId}`} name="lastName" required defaultValue={lastName} className="w-full field" />
        </div>
      </div>
      <div>
        <label htmlFor={`profile-email-${userId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Email
        </label>
        <input id={`profile-email-${userId}`} name="email" type="email" defaultValue={email ?? ""} className="w-full field" />
      </div>
      <div>
        <label htmlFor={`profile-phone-${userId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Phone
        </label>
        <input id={`profile-phone-${userId}`} name="phone" defaultValue={phone ?? ""} className="w-full field" />
      </div>
      {state.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">{state.success}</p>}
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
