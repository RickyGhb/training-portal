"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Role } from "@/generated/prisma/client";
import { createStaffUserAction, createConsultantAction } from "@/app/(app)/users/actions";
import { suggestConsultantUsernameAction } from "@/app/(app)/users/username-suggestion";
import { locationAssignmentModeFor } from "@/lib/auth/rbac";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { OFFSHORE_OFFICE_LABELS } from "@/lib/offshoreOfficeLabels";
import { TECHNOLOGY_OPTIONS, OTHER_TECHNOLOGY_VALUE, deriveOtherAbbrev } from "@/lib/technologyOptions";
import { VISA_TYPE_LABELS } from "@/lib/visaTypeLabels";

const todayStr = new Date().toISOString().slice(0, 10);

type Location = { id: string; name: string };
type Coordinator = { id: string; firstName: string; lastName: string; username: string };

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
  const locationMode = locationAssignmentModeFor(actorRole, role);

  const [firstName, setFirstName] = useState("");
  const [techValue, setTechValue] = useState("");
  const [techOther, setTechOther] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isConsultant) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const abbrev =
      techValue === OTHER_TECHNOLOGY_VALUE
        ? deriveOtherAbbrev(techOther)
        : (TECHNOLOGY_OPTIONS.find((t) => t.value === techValue)?.usernameAbbrev ?? "");

    if (!firstName.trim() || !abbrev) return;

    const thisRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      suggestConsultantUsernameAction(firstName, abbrev).then((suggested) => {
        if (requestIdRef.current !== thisRequestId) return; // stale response
        if (!suggested || usernameTouched) return;
        setUsername(suggested);
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConsultant, firstName, techValue, techOther]);

  return (
    <form action={formAction}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="field-firstName" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            First name
          </label>
          <input
            id="field-firstName"
            name="firstName"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full field"
          />
        </div>
        <Field label="Last name" name="lastName" required />
        <div>
          <label htmlFor="field-username" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Username
          </label>
          <input
            id="field-username"
            name="username"
            required
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setUsernameTouched(true);
            }}
            className="w-full field"
          />
        </div>
        <Field label="Password" name="password" type="text" required />
        <Field label="Email" name="email" type="email" />
        <Field label="Phone" name="phone" />
        {isConsultant ? (
          <>
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
            <div>
              <label htmlFor="field-offshoreOffice" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
                Offshore Office
              </label>
              <select id="field-offshoreOffice" name="offshoreOffice" required className="w-full field" defaultValue="">
                <option value="" disabled>
                  Select an offshore office
                </option>
                {Object.entries(OFFSHORE_OFFICE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="field-technology" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
                Technology
              </label>
              {techValue === OTHER_TECHNOLOGY_VALUE ? (
                <input
                  id="field-technology"
                  name="technology"
                  required
                  placeholder="Enter technology"
                  value={techOther}
                  onChange={(e) => setTechOther(e.target.value)}
                  className="w-full field"
                />
              ) : (
                <select
                  id="field-technology"
                  name="technology"
                  required
                  className="w-full field"
                  value={techValue}
                  onChange={(e) => setTechValue(e.target.value)}
                >
                  <option value="" disabled>
                    Select a technology
                  </option>
                  {TECHNOLOGY_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.value}
                    </option>
                  ))}
                  <option value={OTHER_TECHNOLOGY_VALUE}>Other</option>
                </select>
              )}
              {techValue === OTHER_TECHNOLOGY_VALUE && (
                <button
                  type="button"
                  onClick={() => {
                    setTechValue("");
                    setTechOther("");
                  }}
                  className="mt-1 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  ← Choose from list instead
                </button>
              )}
            </div>
            <div>
              <label htmlFor="field-visaType" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
                Visa Type
              </label>
              <select id="field-visaType" name="visaType" required className="w-full field" defaultValue="">
                <option value="" disabled>
                  Select a visa type
                </option>
                {Object.entries(VISA_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="field-dateOfBirth" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
                Date of Birth
              </label>
              <input
                id="field-dateOfBirth"
                name="dateOfBirth"
                type="date"
                required
                max={todayStr}
                className="w-full field"
              />
            </div>
          </>
        ) : (
          (locationMode === "required" || locationMode === "optional") && (
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
