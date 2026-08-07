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
      <h1 className="page-title">Courses</h1>
      <p className="page-subtitle">
        Reusable modules made of videos. Courses can be attached to multiple training paths or assigned individually
        as extra courses.
      </p>

      <div className="mt-6">
        <CourseForm />
      </div>

      <table className="mt-6 table-shell">
        <thead className="">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="">
          {courses.map((course) => (
            <tr key={course.id}>
              <td className="px-4 py-2 font-medium text-[var(--color-ink)]">{course.name}</td>
              <td className="px-4 py-2 max-w-sm truncate text-[var(--color-ink-soft)]">{course.description}</td>
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
              <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                No courses yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
