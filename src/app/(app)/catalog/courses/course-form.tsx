"use client";

import { useActionState } from "react";
import { createCourseAction } from "./actions";

export function CourseForm() {
  const [state, formAction, pending] = useActionState(createCourseAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
        <input
          name="name"
          required
          className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="Compliance Basics"
        />
      </div>
      <div className="flex-1 min-w-[16rem]">
        <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
        <input
          name="description"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="Optional"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Add course"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
