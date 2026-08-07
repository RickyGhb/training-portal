"use client";

import { useActionState } from "react";
import { createConsultantAction } from "@/app/(app)/users/actions";

type Coordinator = { id: string; firstName: string; lastName: string; username: string };

export function CreateConsultantForm({ coordinators }: { coordinators: Coordinator[] }) {
  const [state, formAction, pending] = useActionState(createConsultantAction, {});

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="First name" name="firstName" required />
        <Field label="Last name" name="lastName" required />
        <Field label="Username" name="username" required />
        <Field label="Password" name="password" type="text" required />
        <Field label="Email" name="email" type="email" />
        <Field label="Phone" name="phone" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Coordinator</label>
          <select
            name="coordinatorId"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Select a coordinator
            </option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} ({c.username})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create consultant"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">{state.success}</p>}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Assign a primary training path and any extra courses from the consultant&apos;s &ldquo;Training &amp;
        progress&rdquo; page after creating them.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      />
    </div>
  );
}
