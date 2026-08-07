import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canManageCatalogStructure } from "@/lib/auth/rbac";
import { StatusBadge } from "@/components/ui/Badge";
import { CourseVideoList } from "./course-video-list";
import { AddVideoForm } from "./add-video-form";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageCatalogStructure(user.role)) redirect("/dashboard");

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      videos: {
        orderBy: { sortOrder: "asc" },
        include: { video: { select: { id: true, title: true, status: true, durationSeconds: true } } },
      },
    },
  });
  if (!course) notFound();

  const attachedVideoIds = course.videos.map((v) => v.videoId);
  const availableVideos = await prisma.video.findMany({
    where: { status: "ACTIVE", id: { notIn: attachedVideoIds } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return (
    <div>
      <Link href="/catalog/courses" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        ← Courses
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="page-title">{course.name}</h1>
        <StatusBadge status={course.status} />
      </div>
      {course.description && <p className="page-subtitle">{course.description}</p>}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Videos in this course</h2>
      <CourseVideoList courseId={course.id} rows={course.videos} />
      <AddVideoForm courseId={course.id} availableVideos={availableVideos} />
    </div>
  );
}
