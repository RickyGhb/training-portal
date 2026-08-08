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
    return <p className="mt-4 text-sm text-[var(--color-ink-faint)]">Every active course is already attached to this path.</p>;
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
        <label htmlFor="add-course-select" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Add course
        </label>
        <select id="add-course-select" name="courseId" required className="w-64 field">
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
        className="btn-primary"
      >
        Add
      </button>
    </form>
  );
}
