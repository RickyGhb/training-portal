import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canManageCatalogStructure } from "@/lib/auth/rbac";
import { StatusBadge } from "@/components/ui/Badge";
import { PathCourseList } from "./path-course-list";
import { AddCourseForm } from "./add-course-form";

export default async function TrainingPathDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageCatalogStructure(user.role)) redirect("/dashboard");

  const path = await prisma.trainingPath.findUnique({
    where: { id },
    include: {
      courses: {
        orderBy: { sortOrder: "asc" },
        include: { course: { select: { id: true, name: true, status: true } } },
      },
    },
  });
  if (!path) notFound();

  const attachedCourseIds = path.courses.map((c) => c.courseId);
  const availableCourses = await prisma.course.findMany({
    where: { status: "ACTIVE", id: { notIn: attachedCourseIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <Link href="/catalog/training-paths" className="text-sm text-slate-500 hover:text-slate-700">
        ← Training Paths
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{path.name}</h1>
        <StatusBadge status={path.status} />
      </div>
      {path.description && <p className="mt-1 text-sm text-slate-500">{path.description}</p>}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Courses in this path</h2>
      <PathCourseList trainingPathId={path.id} rows={path.courses} />
      <AddCourseForm trainingPathId={path.id} availableCourses={availableCourses} />
    </div>
  );
}
