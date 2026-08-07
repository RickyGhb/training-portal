import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getResolvedCourseDetail } from "@/lib/content-resolution";

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function MyCourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CONSULTANT") redirect("/dashboard");

  const detail = await getResolvedCourseDetail(user.id, courseId);
  if (!detail) notFound();

  return (
    <div>
      <Link href="/my-courses" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        ← My Courses
      </Link>

      <h1 className="mt-2 page-title">{detail.course.name}</h1>
      {detail.course.description && <p className="page-subtitle">{detail.course.description}</p>}
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        {detail.course.completedVideoCount}/{detail.course.videoCount} videos completed
      </p>

      <ol className="mt-6  rounded-lg border border-[var(--color-border)] bg-white">
        {detail.videos.map((v, index) => (
          <li key={v.id} className="flex items-center justify-between px-4 py-3">
            <Link href={`/my-courses/${courseId}/${v.id}`} className="text-sm font-medium text-[var(--color-ink)] hover:text-blue-700">
              {index + 1}. {v.title}
              {formatDuration(v.durationSeconds) && (
                <span className="ml-2 text-xs font-normal text-[var(--color-ink-faint)]">{formatDuration(v.durationSeconds)}</span>
              )}
            </Link>
            {v.completed ? (
              <span className="text-xs font-medium text-green-700">✓ Completed</span>
            ) : (
              <span className="text-xs text-[var(--color-ink-faint)]">Not started</span>
            )}
          </li>
        ))}
        {detail.videos.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-[var(--color-ink-faint)]">No videos in this course yet.</li>
        )}
      </ol>
    </div>
  );
}
