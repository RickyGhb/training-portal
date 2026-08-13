"use client";

import Link from "next/link";
import { FormModalButton } from "@/components/ui/FormModalButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { TECHNOLOGY_OPTIONS } from "@/lib/technologyOptions";
import {
  updateTrainingPathAction,
  setTrainingPathStatusAction,
  deleteTrainingPathAction,
} from "./actions";

export function TrainingPathRowActions({
  id,
  name,
  description,
  technology,
  status,
  courseCount,
  assignmentCount,
}: {
  id: string;
  name: string;
  description: string | null;
  technology: string | null;
  status: "ACTIVE" | "ARCHIVED";
  courseCount: number;
  assignmentCount: number;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link href={`/catalog/training-paths/${id}`} className="link-action">
        Manage courses ({courseCount})
      </Link>

      <FormModalButton
        action={updateTrainingPathAction}
        hiddenFields={{ trainingPathId: id }}
        title="Edit training path"
        label="Edit"
      >
        <div>
          <label htmlFor={`training-path-name-${id}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Name
          </label>
          <input id={`training-path-name-${id}`} name="name" required defaultValue={name} className="w-full field" />
        </div>
        <div>
          <label htmlFor={`training-path-description-${id}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Description
          </label>
          <input
            id={`training-path-description-${id}`}
            name="description"
            defaultValue={description ?? ""}
            className="w-full field"
          />
        </div>
        <div>
          <label htmlFor={`training-path-technology-${id}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Technology
          </label>
          <select
            id={`training-path-technology-${id}`}
            name="technology"
            defaultValue={technology ?? ""}
            className="w-full field"
          >
            <option value="">— General (no technology) —</option>
            {TECHNOLOGY_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.value}
              </option>
            ))}
          </select>
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
