"use client";

import { useRef } from "react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { addExtraCourseAction, removeExtraCourseAction } from "./actions";

export function ExtraCourses({
  consultantUserId,
  extraCourses,
  availableCourses,
}: {
  consultantUserId: string;
  extraCourses: { id: string; name: string }[];
  availableCourses: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      {extraCourses.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-ink-faint)]">No extra courses assigned.</p>
      ) : (
        <ul className="mt-2  rounded-lg border border-[var(--color-border)] bg-white">
          {extraCourses.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="font-medium text-[var(--color-ink)]">{c.name}</span>
              <ConfirmButton
                action={removeExtraCourseAction}
                hiddenFields={{ consultantUserId, courseId: c.id }}
                confirmTitle="Remove extra course?"
                confirmMessage={`"${c.name}" will no longer be assigned to this consultant (unless it's also part of their primary path).`}
                confirmLabel="Remove"
                label="Remove"
                variant="danger"
              />
            </li>
          ))}
        </ul>
      )}

      {availableCourses.length > 0 && (
        <form
          ref={formRef}
          action={async (formData) => {
            await addExtraCourseAction(formData);
            formRef.current?.reset();
          }}
          className="mt-3 flex items-end gap-3"
        >
          <input type="hidden" name="consultantUserId" value={consultantUserId} />
          <div>
            <label htmlFor="extra-course-select" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Add extra course
            </label>
            <select id="extra-course-select" name="courseId" required className="w-64 field">
              <option value="">Select a course...</option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
