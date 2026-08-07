import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrimaryTrainingPath, getConsultantProgress } from "@/lib/content-resolution";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === "CONSULTANT") {
    const [assignment, progress] = await Promise.all([
      getPrimaryTrainingPath(user.id),
      getConsultantProgress(user.id),
    ]);

    return (
      <div>
        <h1 className="page-title">Welcome, {user.firstName}</h1>
        <p className="page-subtitle">
          {assignment ? `Training path: ${assignment.trainingPath.name}` : "No training path assigned yet."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card">
            <div className="stat-number">{progress.completionPercentage}%</div>
            <div className="text-xs text-[var(--color-ink-soft)]">Complete</div>
          </div>
          <div className="card">
            <div className="stat-number">{progress.completedVideos}</div>
            <div className="text-xs text-[var(--color-ink-soft)]">Videos completed</div>
          </div>
          <div className="card">
            <div className="stat-number">{progress.pendingVideos}</div>
            <div className="text-xs text-[var(--color-ink-soft)]">Videos pending</div>
          </div>
          <div className="card">
            <div className="stat-number">{progress.totalCourses}</div>
            <div className="text-xs text-[var(--color-ink-soft)]">Assigned courses</div>
          </div>
        </div>
        {progress.lastCompletedVideoTitle && (
          <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
            Last completed: {progress.lastCompletedVideoTitle}
            {progress.lastCompletedAt && ` on ${progress.lastCompletedAt.toLocaleDateString()}`}
          </p>
        )}

        <Link
          href="/my-courses"
          className="mt-6 inline-block btn-primary"
        >
          Go to My Courses
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Welcome, {user.firstName}</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        See consultant progress, completion breakdowns, and filters on the Reports page.
      </p>
      <Link
        href="/reports"
        className="mt-4 inline-block btn-primary"
      >
        Go to Reports
      </Link>
    </div>
  );
}
