import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getResolvedCourses } from "@/lib/content-resolution";

const SOURCE_LABEL: Record<string, string> = {
  path: "Assigned by path",
  extra: "Extra course",
  both: "Assigned by path + Extra",
};

export default async function MyCoursesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CONSULTANT") redirect("/dashboard");

  const courses = await getResolvedCourses(user.id);

  return (
    <div>
      <h1 className="page-title">My Courses</h1>
      <p className="page-subtitle">Everything assigned to you, from your training path and any extras.</p>

      {courses.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-ink-faint)]">No courses assigned yet — check back once your coordinator sets this up.</p>
      ) : (
        <ul className="mt-6  rounded-lg border border-[var(--color-border)] bg-white">
          {courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/my-courses/${c.id}`} className="text-sm font-medium text-[var(--color-ink)] hover:text-blue-700">
                  {c.name}
                </Link>
                <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{SOURCE_LABEL[c.source]}</div>
              </div>
              <div className="text-sm text-[var(--color-ink-soft)]">
                {c.completedVideoCount}/{c.videoCount} videos
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
