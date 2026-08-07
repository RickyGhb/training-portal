"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  updateUsernameAction,
  resetPasswordAction,
  setUserStatusAction,
  deleteUserAction,
} from "@/app/(app)/users/actions";

export function UserRowActions({
  userId,
  username,
  fullName,
  status,
  isSelf,
}: {
  userId: string;
  username: string;
  fullName: string;
  status: "ACTIVE" | "DEACTIVATED" | "DELETED";
  isSelf?: boolean;
}) {
  if (status === "DELETED") {
    return <span className="text-xs text-[var(--color-ink-faint)]">Archived</span>;
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <FormModalButton
        action={updateUsernameAction}
        hiddenFields={{ userId }}
        title="Change username"
        description={`Current username: ${username}`}
        label="Edit username"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">New username</label>
          <input
            name="newUsername"
            required
            defaultValue={username}
            className="w-full field"
          />
        </div>
      </FormModalButton>

      <FormModalButton
        action={resetPasswordAction}
        hiddenFields={{ userId }}
        title="Reset password"
        description={`Set a new password for ${fullName}. Their existing sessions will be signed out.`}
        label="Reset password"
        submitLabel="Reset"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">New password</label>
          <input
            name="newPassword"
            type="text"
            required
            className="w-full field"
          />
        </div>
      </FormModalButton>

      {!isSelf &&
        (status === "ACTIVE" ? (
          <ConfirmButton
            action={setUserStatusAction}
            hiddenFields={{ userId, nextStatus: "DEACTIVATED" }}
            confirmTitle="Deactivate this account?"
            confirmMessage={`${fullName} (${username}) will no longer be able to log in, and will be hidden from default lists until reactivated.`}
            confirmLabel="Deactivate"
            label="Deactivate"
          />
        ) : (
          <ConfirmButton
            action={setUserStatusAction}
            hiddenFields={{ userId, nextStatus: "ACTIVE" }}
            confirmTitle="Reactivate this account?"
            confirmMessage={`${fullName} (${username}) will be able to log in again.`}
            confirmLabel="Reactivate"
            label="Reactivate"
          />
        ))}

      {!isSelf && (
        <ConfirmButton
          action={deleteUserAction}
          hiddenFields={{ userId }}
          confirmTitle="Delete this account?"
          confirmMessage={`${fullName} (${username}) will be removed from active views. Their history is kept for audit and reporting.`}
          confirmLabel="Delete"
          label="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}
