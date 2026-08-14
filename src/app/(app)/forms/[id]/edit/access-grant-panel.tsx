"use client";

import { useActionState } from "react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { grantFormAccessAction, revokeFormAccessAction } from "../../actions";
import { ROLE_LABELS } from "@/lib/roleLabels";
import type { Role } from "@/generated/prisma/client";

export function AccessGrantPanel({
  formId,
  grants,
}: {
  formId: string;
  grants: { id: string; username: string; firstName: string; lastName: string; role: Role }[];
}) {
  const [state, formAction, pending] = useActionState(grantFormAccessAction, {});

  return (
    <div className="card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Share with someone</h2>
      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
        Grant a specific person access to this form&apos;s responses, in addition to whoever already sees it through
        the org hierarchy or location matching.
      </p>

      <form action={formAction} className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="grant-username" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Username
          </label>
          <input id="grant-username" name="username" required className="w-full field" />
        </div>
        <input type="hidden" name="formId" value={formId} />
        <button type="submit" disabled={pending} className="btn-secondary disabled:opacity-50">
          {pending ? "Sharing..." : "Share"}
        </button>
      </form>
      {state.error && <p className="mt-2 text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="mt-2 text-sm text-green-700">{state.success}</p>}

      {grants.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {grants.map((grant) => (
            <li key={grant.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {grant.firstName} {grant.lastName} ({ROLE_LABELS[grant.role]})
              </span>
              <ConfirmButton
                action={revokeFormAccessAction}
                hiddenFields={{ formId, grantId: grant.id }}
                confirmTitle="Remove access?"
                confirmMessage={`${grant.firstName} ${grant.lastName} will no longer be able to see this form's responses.`}
                confirmLabel="Remove"
                label="Remove"
                variant="danger"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
