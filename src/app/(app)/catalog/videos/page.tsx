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
      <h1 className="text-2xl font-semibold text-slate-900">Videos</h1>
      <p className="mt-1 text-sm text-slate-500">
        Videos are embedded from Google Drive and can be reused across multiple courses.
      </p>

      <div className="mt-6">
        <VideoForm />
      </div>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Duration</th>
            <th className="px-4 py-2">Used in</th>
            <th className="px-4 py-2">Preview</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {videos.map((video) => (
            <tr key={video.id}>
              <td className="px-4 py-2 font-medium text-slate-900">{video.title}</td>
              <td className="px-4 py-2 text-slate-600">{formatDuration(video.durationSeconds)}</td>
              <td className="px-4 py-2 text-slate-600">{video._count.courses} course(s)</td>
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
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                No videos yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
