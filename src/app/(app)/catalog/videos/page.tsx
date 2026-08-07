import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canManageVideos } from "@/lib/auth/rbac";
import { StatusBadge } from "@/components/ui/Badge";
import { VideoForm } from "./video-form";
import { VideoRowActions } from "./video-row-actions";

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function VideosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageVideos(user.role)) redirect("/dashboard");

  const videos = await prisma.video.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { courses: true } } },
  });

  return (
    <div>
      <h1 className="page-title">Videos</h1>
      <p className="page-subtitle">
        Videos are embedded from Google Drive and can be reused across multiple courses.
      </p>

      <div className="mt-6">
        <VideoForm />
      </div>

      <table className="mt-6 table-shell">
        <thead className="">
          <tr>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Duration</th>
            <th className="px-4 py-2">Used in</th>
            <th className="px-4 py-2">Preview</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="">
          {videos.map((video) => (
            <tr key={video.id}>
              <td className="px-4 py-2 font-medium text-[var(--color-ink)]">{video.title}</td>
              <td className="px-4 py-2 text-[var(--color-ink-soft)]">{formatDuration(video.durationSeconds)}</td>
              <td className="px-4 py-2 text-[var(--color-ink-soft)]">{video._count.courses} course(s)</td>
              <td className="px-4 py-2">
                <a
                  href={video.embedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Open
                </a>
              </td>
              <td className="px-4 py-2">
                <StatusBadge status={video.status} />
              </td>
              <td className="px-4 py-2">
                <VideoRowActions
                  id={video.id}
                  title={video.title}
                  description={video.description}
                  thumbnailUrl={video.thumbnailUrl}
                  durationSeconds={video.durationSeconds}
                  status={video.status}
                  courseCount={video._count.courses}
                />
              </td>
            </tr>
          ))}
          {videos.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                No videos yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
