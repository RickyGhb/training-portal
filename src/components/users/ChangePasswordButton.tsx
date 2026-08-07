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
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-shell-text)]/80 transition-colors hover:bg-white/[0.06] hover:text-[var(--color-shell-text)]"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Current password</label>
        <input name="currentPassword" type="password" required className="w-full field" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">New password</label>
        <input name="newPassword" type="password" required className="w-full field" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Confirm new password</label>
        <input name="confirmPassword" type="password" required className="w-full field" />
      </div>
    </FormModalButton>
  );
}
