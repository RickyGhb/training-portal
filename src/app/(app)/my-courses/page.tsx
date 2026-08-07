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
      <h1 className="text-2xl font-semibold text-slate-900">My Courses</h1>
      <p className="mt-1 text-sm text-slate-500">Everything assigned to you, from your training path and any extras.</p>

      {courses.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No courses assigned yet — check back once your coordinator sets this up.</p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/my-courses/${c.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-700">
                  {c.name}
                </Link>
                <div className="mt-0.5 text-xs text-slate-500">{SOURCE_LABEL[c.source]}</div>
              </div>
              <div className="text-sm text-slate-600">
                {c.completedVideoCount}/{c.videoCount} videos
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
