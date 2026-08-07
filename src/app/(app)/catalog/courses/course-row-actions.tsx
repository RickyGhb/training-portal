"use client";

import Link from "next/link";
import { FormModalButton } from "@/components/ui/FormModalButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { updateCourseAction, setCourseStatusAction, deleteCourseAction } from "./actions";

export function CourseRowActions({
  id,
  name,
  description,
  status,
  videoCount,
  pathCount,
  extraAssignmentCount,
}: {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  videoCount: number;
  pathCount: number;
  extraAssignmentCount: number;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link href={`/catalog/courses/${id}`} className="text-sm font-medium text-slate-700 hover:text-slate-900">
        Manage videos ({videoCount})
      </Link>

      <FormModalButton action={updateCourseAction} hiddenFields={{ courseId: id }} title="Edit course" label="Edit">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
          <input name="name" required defaultValue={name} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
          <input
            name="description"
            defaultValue={description ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      </FormModalButton>

      <ConfirmButton
        action={setCourseStatusAction}
        hiddenFields={{ courseId: id, nextStatus: status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }}
        confirmTitle={status === "ACTIVE" ? "Archive course?" : "Reactivate course?"}
        confirmMessage={
          status === "ACTIVE"
            ? `Archiving "${name}" removes it from active selection lists.`
            : `"${name}" will become selectable again.`
        }
        label={status === "ACTIVE" ? "Archive" : "Reactivate"}
      />

      <ConfirmButton
        action={deleteCourseAction}
        hiddenFields={{ courseId: id }}
        variant="danger"
        confirmTitle="Delete course?"
        confirmMessage={`This course is used in ${pathCount} training path(s) and assigned as an extra course to ${extraAssignmentCount} consultant(s). Deleting "${name}" permanently removes it everywhere. This cannot be undone.`}
        confirmLabel="Delete"
        label="Delete"
      />
    </div>
  );
}
