"use client";

import { useActionState, useState } from "react";
import type { Role } from "@/generated/prisma/client";
import { createStaffUserAction, createConsultantAction } from "@/app/(app)/users/actions";

type Location = { id: string; name: string };
type Coordinator = { id: string; firstName: string; lastName: string; username: string };

const ROLE_LABELS: Record<Role, string> = {
  CEO: "CEO",
  MANAGER: "Manager",
  LOCATION_MANAGER: "Location Manager",
  COORDINATOR: "Coordinator",
  CONSULTANT: "Consultant",
};

function locationModeFor(actorRole: Role, role: Role): "none" | "required" | "optional" {
  if (role === "LOCATION_MANAGER") return "required";
  if (role === "COORDINATOR") {
    if (actorRole === "CEO") return "optional";
    if (actorRole === "LOCATION_MANAGER") return "none"; // auto-assigned to the location manager's own location
    return "required"; // MANAGER must supply a location
  }
  return "none"; // CEO, MANAGER targets are never location-scoped
}

/**
 * One create-user form for every role an actor is allowed to create. The
 * role picker swaps which server action and which extra field (coordinator
 * vs. location) is shown; remounting the fields by `key={role}` keeps each
 * role's useActionState instance isolated.
 */
export function CreateUserForm({
  allowedRoles,
  actorRole,
  locations,
  coordinators,
}: {
  allowedRoles: Role[];
  actorRole: Role;
  locations: Location[];
  coordinators: Coordinator[];
}) {
  const [role, setRole] = useState<Role>(allowedRoles[0]);

  return (
    <div className="card">
      <div className="mb-4 max-w-xs">
        <label htmlFor="account-type" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Account type
        </label>
        <select
          id="account-type"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full field"
        >
          {allowedRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <CreateUserFields
        key={role}
        role={role}
        actorRole={actorRole}
        locations={locations}
        coordinators={coordinators}
      />
    </div>
  );
}

function CreateUserFields({
  role,
  actorRole,
  locations,
  coordinators,
}: {
  role: Role;
  actorRole: Role;
  locations: Location[];
  coordinators: Coordinator[];
}) {
  const isConsultant = role === "CONSULTANT";
  const action = isConsultant ? createConsultantAction : createStaffUserAction.bind(null, role);
  const [state, formAction, pending] = useActionState(action, {});
  const locationMode = locationModeFor(actorRole, role);

  return (
    <form action={formAction}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="First name" name="firstName" required />
        <Field label="Last name" name="lastName" required />
        <Field label="Username" name="username" required />
        <Field label="Password" name="password" type="text" required />
        <Field label="Email" name="email" type="email" />
        <Field label="Phone" name="phone" />
        {isConsultant ? (
          <div>
            <label htmlFor="field-coordinatorId" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Coordinator
            </label>
            <select id="field-coordinatorId" name="coordinatorId" required className="w-full field" defaultValue="">
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
        ) : (
          locationMode !== "none" && (
            <div>
              <label htmlFor="field-locationId" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
                Location{locationMode === "optional" ? " (leave blank to stay independent)" : ""}
              </label>
              <select
                id="field-locationId"
                name="locationId"
                required={locationMode === "required"}
                className="w-full field"
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
          )
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Creating..." : "Create account"}
        </button>
        {state.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">{state.success}</p>}
      </div>
      {isConsultant && (
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          Assign a primary training path and any extra courses from the consultant&apos;s &ldquo;Training &amp;
          progress&rdquo; page after creating them.
        </p>
      )}
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
      <label htmlFor={`field-${name}`} className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
        {label}
      </label>
      <input id={`field-${name}`} name={name} type={type} required={required} className="w-full field" />
    </div>
  );
}
