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
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user.firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {assignment ? `Training path: ${assignment.trainingPath.name}` : "No training path assigned yet."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{progress.completionPercentage}%</div>
            <div className="text-xs text-slate-500">Complete</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{progress.completedVideos}</div>
            <div className="text-xs text-slate-500">Videos completed</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{progress.pendingVideos}</div>
            <div className="text-xs text-slate-500">Videos pending</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{progress.totalCourses}</div>
            <div className="text-xs text-slate-500">Assigned courses</div>
          </div>
        </div>
        {progress.lastCompletedVideoTitle && (
          <p className="mt-2 text-xs text-slate-500">
            Last completed: {progress.lastCompletedVideoTitle}
            {progress.lastCompletedAt && ` on ${progress.lastCompletedAt.toLocaleDateString()}`}
          </p>
        )}

        <Link
          href="/my-courses"
          className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Go to My Courses
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user.firstName}</h1>
      <p className="mt-2 text-sm text-slate-500">
        See consultant progress, completion breakdowns, and filters on the Reports page.
      </p>
      <Link
        href="/reports"
        className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Go to Reports
      </Link>
    </div>
  );
}
