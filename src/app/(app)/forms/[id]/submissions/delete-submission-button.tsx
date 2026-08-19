"use client";

import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { deleteSubmissionAction } from "@/app/(app)/forms/actions";

/**
 * Thin client wrapper so the server action is imported across a client
 * boundary, matching how every other row action in the app is wired
 * (see forms/form-row-actions.tsx, users/UserRowActions.tsx).
 *
 * This is load-bearing, not stylistic: a Server Action is only registered for
 * a route if some client component in that route's own graph imports it. No
 * client component on /forms/[id]/submissions imports forms/actions.ts, so
 * handing deleteSubmissionAction to ConfirmButton as a prop from the
 * server-rendered table leaves it unregistered and every submit fails with
 * "Failed to find Server Action" — reproduced on a clean production build.
 */
export function DeleteSubmissionButton({ formId, submissionId }: { formId: string; submissionId: string }) {
  return (
    <ConfirmButton
      action={deleteSubmissionAction}
      hiddenFields={{ formId, submissionId }}
      label="Delete"
      variant="danger"
      confirmTitle="Delete this response?"
      confirmMessage="This permanently deletes the response and any files uploaded with it. This can't be undone."
      confirmLabel="Delete response"
    />
  );
}
