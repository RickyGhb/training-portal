"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { changeOwnPasswordAction, type FormState } from "@/app/(app)/users/actions";

async function changePasswordWithConfirm(prevState: FormState, formData: FormData): Promise<FormState> {
  const newPassword = String(formData.get("newPassword"));
  const confirmPassword = String(formData.get("confirmPassword"));
  if (newPassword !== confirmPassword) {
    return { error: "New passwords don't match." };
  }
  return changeOwnPasswordAction(prevState, formData);
}

export function ChangePasswordButton() {
  return (
    <FormModalButton
      action={changePasswordWithConfirm}
      title="Change your password"
      description="You'll be signed out everywhere and need to sign back in with the new password."
      submitLabel="Change password"
      label="Change password"
      className="btn-secondary"
    >
      <div>
        <label htmlFor="change-password-current" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Current password
        </label>
        <input id="change-password-current" name="currentPassword" type="password" required className="w-full field" />
      </div>
      <div>
        <label htmlFor="change-password-new" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          New password
        </label>
        <input id="change-password-new" name="newPassword" type="password" required className="w-full field" />
      </div>
      <div>
        <label htmlFor="change-password-confirm" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Confirm new password
        </label>
        <input id="change-password-confirm" name="confirmPassword" type="password" required className="w-full field" />
      </div>
    </FormModalButton>
  );
}
