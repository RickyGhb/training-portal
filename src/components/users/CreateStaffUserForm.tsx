"use client";

import { useActionState } from "react";
import type { Role } from "@/generated/prisma/client";
import { createStaffUserAction } from "@/app/(app)/users/actions";

type Location = { id: string; name: string };

export function CreateStaffUserForm({
  role,
  locationMode,
  locations,
}: {
  role: Role;
  locationMode: "none" | "required" | "optional";
  locations: Location[];
}) {
  const boundAction = createStaffUserAction.bind(null, role);
  const [state, formAction, pending] = useActionState(boundAction, {});

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="First name" name="firstName" required />
        <Field label="Last name" name="lastName" required />
        <Field label="Username" name="username" required />
        <Field label="Password" name="password" type="text" required />
        <Field label="Email" name="email" type="email" />
        <Field label="Phone" name="phone" />
        {locationMode !== "none" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Location{locationMode === "optional" ? " (leave blank to stay independent)" : ""}
            </label>
            <select
              name="locationId"
              required={locationMode === "required"}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              defaultValue=""
            >
              <option value="">{locationMode === "optional" ? "None (independent)" : "Select a location"}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create account"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">{state.success}</p>}
      </div>
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
