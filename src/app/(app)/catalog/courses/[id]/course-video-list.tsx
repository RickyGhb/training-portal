"use client";

import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { removeVideoFromCourseAction, moveVideoInCourseAction } from "../actions";

type CourseVideoRow = {
  id: string;
  sortOrder: number;
  video: { id: string; title: string; status: "ACTIVE" | "ARCHIVED"; durationSeconds: number | null };
};

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CourseVideoList({ courseId, rows }: { courseId: string; rows: CourseVideoRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">No videos attached yet.</p>;
  }

  return (
    <ol className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="font-medium text-slate-900">
            {index + 1}. {row.video.title}
            {formatDuration(row.video.durationSeconds) && (
              <span className="ml-2 text-xs font-normal text-slate-400">{formatDuration(row.video.durationSeconds)}</span>
            )}
            {row.video.status === "ARCHIVED" && (
              <span className="ml-2 text-xs font-normal text-slate-400">(archived)</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <form action={moveVideoInCourseAction}>
              <input type="hidden" name="courseId" value={courseId} />
              <input type="hidden" name="courseVideoId" value={row.id} />
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
            <form action={moveVideoInCourseAction}>
              <input type="hidden" name="courseId" value={courseId} />
              <input type="hidden" name="courseVideoId" value={row.id} />
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
              action={removeVideoFromCourseAction}
              hiddenFields={{ courseId, courseVideoId: row.id }}
              confirmTitle="Remove video from course?"
              confirmMessage={`"${row.video.title}" will no longer be part of this course.`}
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
