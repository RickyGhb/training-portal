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
          <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
          <input name="title" required defaultValue={title} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
          <input
            name="description"
            defaultValue={description ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Duration (seconds)</label>
          <input
            name="durationSeconds"
            type="number"
            min={1}
            defaultValue={durationSeconds ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Thumbnail URL</label>
          <input
            name="thumbnailUrl"
            defaultValue={thumbnailUrl ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
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
