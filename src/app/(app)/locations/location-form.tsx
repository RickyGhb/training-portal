"use client";

import { useActionState } from "react";
import { createLocationAction } from "./actions";

export function LocationForm() {
  const [state, formAction, pending] = useActionState(createLocationAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
        <input
          name="name"
          required
          className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="Dallas Office"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Code</label>
        <input
          name="code"
          required
          className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="DAL"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Add location"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
