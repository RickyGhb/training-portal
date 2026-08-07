"use client";

import { useRef } from "react";
import { addVideoToCourseAction } from "../actions";

export function AddVideoForm({
  courseId,
  availableVideos,
}: {
  courseId: string;
  availableVideos: { id: string; title: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (availableVideos.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">Every active video is already attached to this course.</p>;
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addVideoToCourseAction(formData);
        formRef.current?.reset();
      }}
      className="mt-4 flex items-end gap-3"
    >
      <input type="hidden" name="courseId" value={courseId} />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Add video</label>
        <select name="videoId" required className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">Select a video...</option>
          {availableVideos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add
      </button>
    </form>
  );
}
