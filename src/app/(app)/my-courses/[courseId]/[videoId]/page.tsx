import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getResolvedVideoDetail } from "@/lib/content-resolution";
import { markVideoCompletedAction } from "../../actions";

export default async function VideoPlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; videoId: string }>;
}) {
  const { courseId, videoId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CONSULTANT") redirect("/dashboard");

  const detail = await getResolvedVideoDetail(user.id, courseId, videoId);
  if (!detail) notFound();

  const index = detail.allVideos.findIndex((v) => v.id === videoId);
  const prev = index > 0 ? detail.allVideos[index - 1] : null;
  const next = index >= 0 && index < detail.allVideos.length - 1 ? detail.allVideos[index + 1] : null;

  return (
    <div>
      <Link href={`/my-courses/${courseId}`} className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        ← {detail.course.name}
      </Link>

      <h1 className="mt-2 page-title">{detail.video.title}</h1>
      {detail.video.description && <p className="page-subtitle">{detail.video.description}</p>}

      <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-black">
        <iframe src={detail.video.embedUrl} className="h-full w-full" allow="autoplay" allowFullScreen />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          {prev && (
            <Link href={`/my-courses/${courseId}/${prev.id}`} className="link-action">
              ← Previous
            </Link>
          )}
        </div>

        {detail.video.completed ? (
          <span className="rounded-full bg-[var(--color-success-soft)] px-3 py-1.5 text-sm font-medium text-[var(--color-success)]">
            ✓ Completed{detail.video.completedAt && ` on ${detail.video.completedAt.toLocaleDateString()}`}
          </span>
        ) : (
          <form action={markVideoCompletedAction}>
            <input type="hidden" name="videoId" value={videoId} />
            <input type="hidden" name="courseId" value={courseId} />
            <button
              type="submit"
              className="btn-primary"
            >
              Mark as Completed
            </button>
          </form>
        )}

        <div>
          {next && (
            <Link href={`/my-courses/${courseId}/${next.id}`} className="link-action">
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
