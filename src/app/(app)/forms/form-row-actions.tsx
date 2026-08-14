"use client";

import Link from "next/link";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { setFormStatusAction, deleteFormAction } from "./actions";

export function FormRowActions({
  id,
  title,
  status,
  submissionCount,
  canEdit,
}: {
  id: string;
  title: string;
  status: string;
  submissionCount: number;
  canEdit: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link href={`/forms/${id}/submissions`} className="link-action">
        Responses ({submissionCount})
      </Link>
      {canEdit && (
        <>
          <Link href={`/forms/${id}/edit`} className="link-action">
            Edit
          </Link>
          {status === "ACTIVE" ? (
            <ConfirmButton
              action={setFormStatusAction}
              hiddenFields={{ formId: id, nextStatus: "ARCHIVED" }}
              confirmTitle="Archive form?"
              confirmMessage={`"${title}" will stop accepting new responses. Existing responses are kept.`}
              confirmLabel="Archive"
              label="Archive"
            />
          ) : (
            <ConfirmButton
              action={setFormStatusAction}
              hiddenFields={{ formId: id, nextStatus: "ACTIVE" }}
              confirmTitle="Reactivate form?"
              confirmMessage={`"${title}" will start accepting new responses again.`}
              confirmLabel="Reactivate"
              label="Reactivate"
            />
          )}
          <ConfirmButton
            action={deleteFormAction}
            hiddenFields={{ formId: id }}
            confirmTitle="Delete form?"
            confirmMessage={`Deleting "${title}" permanently removes it and all its questions. This cannot be undone.`}
            confirmLabel="Delete"
            label="Delete"
            variant="danger"
          />
        </>
      )}
    </div>
  );
}
