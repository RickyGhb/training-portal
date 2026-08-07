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
    return <p className="mt-4 text-sm text-[var(--color-ink-faint)]">No courses attached yet.</p>;
  }

  return (
    <ol className="mt-4  rounded-lg border border-[var(--color-border)] bg-white">
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="font-medium text-[var(--color-ink)]">
            {index + 1}. {row.course.name}
            {row.course.status === "ARCHIVED" && (
              <span className="ml-2 text-xs font-normal text-[var(--color-ink-faint)]">(archived)</span>
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
                className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-30"
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
                className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-30"
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
