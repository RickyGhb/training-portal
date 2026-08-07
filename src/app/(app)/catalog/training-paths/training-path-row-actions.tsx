"use client";

import Link from "next/link";
import { FormModalButton } from "@/components/ui/FormModalButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  updateTrainingPathAction,
  setTrainingPathStatusAction,
  deleteTrainingPathAction,
} from "./actions";

export function TrainingPathRowActions({
  id,
  name,
  description,
  status,
  courseCount,
  assignmentCount,
}: {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  courseCount: number;
  assignmentCount: number;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link href={`/catalog/training-paths/${id}`} className="text-sm font-medium text-slate-700 hover:text-slate-900">
        Manage courses ({courseCount})
      </Link>

      <FormModalButton
        action={updateTrainingPathAction}
        hiddenFields={{ trainingPathId: id }}
        title="Edit training path"
        label="Edit"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
          <input name="name" required defaultValue={name} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
          <input
            name="description"
            defaultValue={description ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      </FormModalButton>

      <ConfirmButton
        action={setTrainingPathStatusAction}
        hiddenFields={{ trainingPathId: id, nextStatus: status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }}
        confirmTitle={status === "ACTIVE" ? "Archive training path?" : "Reactivate training path?"}
        confirmMessage={
          status === "ACTIVE"
            ? `Archiving "${name}" removes it from active selection lists.`
            : `"${name}" will become selectable again.`
        }
        label={status === "ACTIVE" ? "Archive" : "Reactivate"}
      />

      <ConfirmButton
        action={deleteTrainingPathAction}
        hiddenFields={{ trainingPathId: id }}
        variant="danger"
        confirmTitle="Delete training path?"
        confirmMessage={
          assignmentCount > 0
            ? `"${name}" is currently the primary path for ${assignmentCount} consultant(s). Deleting it permanently removes it and its course mapping.`
            : `This permanently deletes "${name}" and its course mapping. This cannot be undone.`
        }
        confirmLabel="Delete"
        label="Delete"
      />
    </div>
  );
}
