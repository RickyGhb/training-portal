import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canManageCatalogStructure } from "@/lib/auth/rbac";
import { StatusBadge } from "@/components/ui/Badge";
import { CourseForm } from "./course-form";
import { CourseRowActions } from "./course-row-actions";

export default async function CoursesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageCatalogStructure(user.role)) redirect("/dashboard");

  const courses = await prisma.course.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { videos: true, trainingPaths: true, extraAssignments: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Courses</h1>
      <p className="mt-1 text-sm text-slate-500">
        Reusable modules made of videos. Courses can be attached to multiple training paths or assigned individually
        as extra courses.
      </p>

      <div className="mt-6">
        <CourseForm />
      </div>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {courses.map((course) => (
            <tr key={course.id}>
              <td className="px-4 py-2 font-medium text-slate-900">{course.name}</td>
              <td className="px-4 py-2 max-w-sm truncate text-slate-600">{course.description}</td>
              <td className="px-4 py-2">
                <StatusBadge status={course.status} />
              </td>
              <td className="px-4 py-2">
                <CourseRowActions
                  id={course.id}
                  name={course.name}
                  description={course.description}
                  status={course.status}
                  videoCount={course._count.videos}
                  pathCount={course._count.trainingPaths}
                  extraAssignmentCount={course._count.extraAssignments}
                />
              </td>
            </tr>
          ))}
          {courses.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                No courses yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
