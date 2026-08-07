"use client";

import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { removeCourseFromPathAction, moveCourseInPathAction } from "../actions";

type PathCourseRow = {
  id: string;
  sortOrder: number;
  course: { id: string; name: string; status: "ACTIVE" | "ARCHIVED" };
};

export function PathCourseList({ trainingPathId, rows }: { trainingPathId: string; rows: PathCourseRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">No courses attached yet.</p>;
  }

  return (
    <ol className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="font-medium text-slate-900">
            {index + 1}. {row.course.name}
            {row.course.status === "ARCHIVED" && (
              <span className="ml-2 text-xs font-normal text-slate-400">(archived)</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <form action={moveCourseInPathAction}>
              <input type="hidden" name="trainingPathId" value={trainingPathId} />
              <input type="hidden" name="trainingPathCourseId" value={row.id} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={index === 0}
                className="text-slate-500 hover:text-slate-900 disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
            </form>
            <form action={moveCourseInPathAction}>
              <input type="hidden" name="trainingPathId" value={trainingPathId} />
              <input type="hidden" name="trainingPathCourseId" value={row.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={index === rows.length - 1}
                className="text-slate-500 hover:text-slate-900 disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
            </form>
            <ConfirmButton
              action={removeCourseFromPathAction}
              hiddenFields={{ trainingPathId, trainingPathCourseId: row.id }}
              confirmTitle="Remove course from path?"
              confirmMessage={`"${row.course.name}" will no longer be part of this training path.`}
              confirmLabel="Remove"
              label="Remove"
              variant="danger"
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
