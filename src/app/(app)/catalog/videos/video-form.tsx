"use client";

import { useActionState } from "react";
import { createVideoAction } from "./actions";

export function VideoForm() {
  const [state, formAction, pending] = useActionState(createVideoAction, {});

  return (
    <form action={formAction} className="card">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="video-title" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Title
          </label>
          <input
            id="video-title"
            name="title"
            required
            className="w-56 field"
            placeholder="Intro to the CRM"
          />
        </div>
        <div className="flex-1 min-w-[20rem]">
          <label htmlFor="video-drive-url" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Google Drive share link
          </label>
          <input
            id="video-drive-url"
            name="driveUrl"
            required
            className="w-full field"
            placeholder="https://drive.google.com/file/d/.../view"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[16rem]">
          <label htmlFor="video-description" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Description
          </label>
          <input
            id="video-description"
            name="description"
            className="w-full field"
            placeholder="Optional"
          />
        </div>
        <div>
          <label htmlFor="video-duration" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Duration (seconds)
          </label>
          <input
            id="video-duration"
            name="durationSeconds"
            type="number"
            min={1}
            className="w-32 field"
            placeholder="Optional"
          />
        </div>
        <div>
          <label htmlFor="video-thumbnail-url" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Thumbnail URL
          </label>
          <input
            id="video-thumbnail-url"
            name="thumbnailUrl"
            className="w-56 field"
            placeholder="Optional"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add video"}
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="mt-2 text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
