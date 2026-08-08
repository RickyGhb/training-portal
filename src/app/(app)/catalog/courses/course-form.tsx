"use client";

import { useActionState } from "react";
import { createCourseAction } from "./actions";

export function CourseForm() {
  const [state, formAction, pending] = useActionState(createCourseAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 card">
      <div>
        <label htmlFor="course-name" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Name
        </label>
        <input
          id="course-name"
          name="name"
          required
          className="w-56 field"
          placeholder="Compliance Basics"
        />
      </div>
      <div className="flex-1 min-w-[16rem]">
        <label htmlFor="course-description" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Description
        </label>
        <input
          id="course-description"
          name="description"
          className="w-full field"
          placeholder="Optional"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary disabled:opacity-50"
      >
        {pending ? "Creating..." : "Add course"}
      </button>
      {state.error && <p className="w-full text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
