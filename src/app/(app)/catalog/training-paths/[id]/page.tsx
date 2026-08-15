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

  // Independent of the attach state, so run in parallel and filter attached
  // courses out in JS below rather than awaiting the path first.
  const [path, activeCourses] = await Promise.all([
    prisma.trainingPath.findUnique({
      where: { id },
      include: {
        courses: {
          orderBy: { sortOrder: "asc" },
          include: { course: { select: { id: true, name: true, status: true } } },
        },
      },
    }),
    prisma.course.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!path) notFound();

  const attachedCourseIds = new Set(path.courses.map((c) => c.courseId));
  const availableCourses = activeCourses.filter((c) => !attachedCourseIds.has(c.id));

  return (
    <div>
      <Link href="/catalog/training-paths" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        ← Training Paths
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="page-title">{path.name}</h1>
        <StatusBadge status={path.status} />
      </div>
      {path.description && <p className="page-subtitle">{path.description}</p>}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Courses in this path</h2>
      <PathCourseList trainingPathId={path.id} rows={path.courses} />
      <AddCourseForm trainingPathId={path.id} availableCourses={availableCourses} />
    </div>
  );
}
