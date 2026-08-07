"use client";

import { useRef } from "react";
import { addCourseToPathAction } from "../actions";

export function AddCourseForm({
  trainingPathId,
  availableCourses,
}: {
  trainingPathId: string;
  availableCourses: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (availableCourses.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">Every active course is already attached to this path.</p>;
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addCourseToPathAction(formData);
        formRef.current?.reset();
      }}
      className="mt-4 flex items-end gap-3"
    >
      <input type="hidden" name="trainingPathId" value={trainingPathId} />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Add course</label>
        <select name="courseId" required className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">Select a course...</option>
          {availableCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
