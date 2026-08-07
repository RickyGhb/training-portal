"use client";

import { useActionState } from "react";
import { createVideoAction } from "./actions";

export function VideoForm() {
  const [state, formAction, pending] = useActionState(createVideoAction, {});

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
          <input
            name="title"
            required
            className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Intro to the CRM"
          />
        </div>
        <div className="flex-1 min-w-[20rem]">
          <label className="mb-1 block text-xs font-medium text-slate-700">Google Drive share link</label>
          <input
            name="driveUrl"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="https://drive.google.com/file/d/.../view"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[16rem]">
          <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
          <input
            name="description"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Duration (seconds)</label>
          <input
            name="durationSeconds"
            type="number"
            min={1}
            className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Thumbnail URL</label>
          <input
            name="thumbnailUrl"
            className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Optional"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add video"}
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="mt-2 text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
