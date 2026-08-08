"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { updateVideoAction, setVideoStatusAction, deleteVideoAction } from "./actions";

export function VideoRowActions({
  id,
  title,
  description,
  thumbnailUrl,
  durationSeconds,
  status,
  courseCount,
}: {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  status: "ACTIVE" | "ARCHIVED";
  courseCount: number;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <FormModalButton action={updateVideoAction} hiddenFields={{ videoId: id }} title="Edit video" label="Edit">
        <div>
          <label htmlFor={`video-title-${id}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Title
          </label>
          <input id={`video-title-${id}`} name="title" required defaultValue={title} className="w-full field" />
        </div>
        <div>
          <label htmlFor={`video-description-${id}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Description
          </label>
          <input
            id={`video-description-${id}`}
            name="description"
            defaultValue={description ?? ""}
            className="w-full field"
          />
        </div>
        <div>
          <label htmlFor={`video-duration-${id}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Duration (seconds)
          </label>
          <input
            id={`video-duration-${id}`}
            name="durationSeconds"
            type="number"
            min={1}
            defaultValue={durationSeconds ?? ""}
            className="w-full field"
          />
        </div>
        <div>
          <label htmlFor={`video-thumbnail-${id}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Thumbnail URL
          </label>
          <input
            id={`video-thumbnail-${id}`}
            name="thumbnailUrl"
            defaultValue={thumbnailUrl ?? ""}
            className="w-full field"
          />
        </div>
      </FormModalButton>

      <ConfirmButton
        action={setVideoStatusAction}
        hiddenFields={{ videoId: id, nextStatus: status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }}
        confirmTitle={status === "ACTIVE" ? "Archive video?" : "Reactivate video?"}
        confirmMessage={
          status === "ACTIVE"
            ? `Archiving "${title}" removes it from active selection lists.`
            : `"${title}" will become selectable again.`
        }
        label={status === "ACTIVE" ? "Archive" : "Reactivate"}
      />

      <ConfirmButton
        action={deleteVideoAction}
        hiddenFields={{ videoId: id }}
        variant="danger"
        confirmTitle="Delete video?"
        confirmMessage={
          courseCount > 0
            ? `This video is used in ${courseCount} course(s). Deleting "${title}" removes it from all of them permanently.`
            : `This permanently deletes "${title}". This cannot be undone.`
        }
        confirmLabel="Delete"
        label="Delete"
      />
    </div>
  );
}
