"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { updateUsernameAction } from "@/app/(app)/users/actions";

export function UsernameEditButton({
  userId,
  username,
  label = "Edit username",
}: {
  userId: string;
  username: string;
  label?: string;
}) {
  return (
    <FormModalButton
      action={updateUsernameAction}
      hiddenFields={{ userId }}
      title="Change username"
      description={`Current username: ${username}`}
      label={label}
    >
      <div>
        <label htmlFor={`new-username-${userId}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          New username
        </label>
        <input
          id={`new-username-${userId}`}
          name="newUsername"
          required
          defaultValue={username}
          className="w-full field"
        />
      </div>
    </FormModalButton>
  );
}
