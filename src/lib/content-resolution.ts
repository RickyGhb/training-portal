import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Resolves what a consultant can actually see, per Technical Implementation
 * Blueprint.md §8: resolved courses = primary training path courses UNION
 * extra assigned courses; resolved videos = all videos mapped to resolved
 * courses. This must happen in backend queries, not just the frontend.
 * Archived courses/videos are excluded from the consultant-facing set.
 */

export type ResolvedCourse = {
  id: string;
  name: string;
  description: string | null;
  source: "path" | "extra" | "both";
  videoCount: number;
  completedVideoCount: number;
};

export async function getPrimaryTrainingPath(consultantUserId: string) {
  return prisma.consultantTrainingAssignment.findUnique({
    where: { consultantUserId },
    include: { trainingPath: true },
  });
}

export async function getResolvedCourses(consultantUserId: string): Promise<ResolvedCourse[]> {
  const assignment = await prisma.consultantTrainingAssignment.findUnique({ where: { consultantUserId } });

  const [pathCourses, extraCourses] = await Promise.all([
    assignment
      ? prisma.trainingPathCourse.findMany({
          where: { trainingPathId: assignment.trainingPathId, course: { status: "ACTIVE" } },
          include: { course: true },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    prisma.consultantExtraCourse.findMany({
      where: { consultantUserId, course: { status: "ACTIVE" } },
      include: { course: true },
      orderBy: { assignedAt: "asc" },
    }),
  ]);

  const byId = new Map<string, ResolvedCourse>();
  for (const pc of pathCourses) {
    byId.set(pc.course.id, {
      id: pc.course.id,
      name: pc.course.name,
      description: pc.course.description,
      source: "path",
      videoCount: 0,
      completedVideoCount: 0,
    });
  }
  for (const ec of extraCourses) {
    const existing = byId.get(ec.course.id);
    if (existing) {
      existing.source = "both";
    } else {
      byId.set(ec.course.id, {
        id: ec.course.id,
        name: ec.course.name,
        description: ec.course.description,
        source: "extra",
        videoCount: 0,
        completedVideoCount: 0,
      });
    }
  }

  const courseIds = [...byId.keys()];
  if (courseIds.length === 0) return [];

  const [courseVideos, completions] = await Promise.all([
    prisma.courseVideo.findMany({
      where: { courseId: { in: courseIds }, video: { status: "ACTIVE" } },
      select: { courseId: true, videoId: true },
    }),
    prisma.videoCompletion.findMany({ where: { consultantUserId }, select: { videoId: true } }),
  ]);
  const completedVideoIds = new Set(completions.map((c) => c.videoId));

  for (const cv of courseVideos) {
    const course = byId.get(cv.courseId);
    if (!course) continue;
    course.videoCount += 1;
    if (completedVideoIds.has(cv.videoId)) course.completedVideoCount += 1;
  }

  return [...byId.values()];
}

export async function isCourseResolvedForConsultant(consultantUserId: string, courseId: string): Promise<boolean> {
  const courses = await getResolvedCourses(consultantUserId);
  return courses.some((c) => c.id === courseId);
}

export type ResolvedCourseVideo = {
  id: string;
  title: string;
  description: string | null;
  embedUrl: string;
  durationSeconds: number | null;
  completed: boolean;
  completedAt: Date | null;
};

export async function getResolvedCourseDetail(consultantUserId: string, courseId: string) {
  const resolvedCourses = await getResolvedCourses(consultantUserId);
  const course = resolvedCourses.find((c) => c.id === courseId);
  if (!course) return null;

  const courseVideos = await prisma.courseVideo.findMany({
    where: { courseId, video: { status: "ACTIVE" } },
    orderBy: { sortOrder: "asc" },
    include: { video: true },
  });
  const videoIds = courseVideos.map((cv) => cv.videoId);

  const completions = await prisma.videoCompletion.findMany({
    where: { consultantUserId, videoId: { in: videoIds } },
  });
  const completedMap = new Map(completions.map((c) => [c.videoId, c.completedAt]));

  const videos: ResolvedCourseVideo[] = courseVideos.map((cv) => ({
    id: cv.video.id,
    title: cv.video.title,
    description: cv.video.description,
    embedUrl: cv.video.embedUrl,
    durationSeconds: cv.video.durationSeconds,
    completed: completedMap.has(cv.videoId),
    completedAt: completedMap.get(cv.videoId) ?? null,
  }));

  return { course, videos };
}

export async function getResolvedVideoDetail(consultantUserId: string, courseId: string, videoId: string) {
  const detail = await getResolvedCourseDetail(consultantUserId, courseId);
  if (!detail) return null;
  const video = detail.videos.find((v) => v.id === videoId);
  if (!video) return null;
  return { course: detail.course, video, allVideos: detail.videos };
}

export type ConsultantProgress = {
  totalCourses: number;
  totalVideos: number;
  completedVideos: number;
  pendingVideos: number;
  completionPercentage: number;
  lastCompletedVideoTitle: string | null;
  lastCompletedAt: Date | null;
};

export async function getConsultantProgress(consultantUserId: string): Promise<ConsultantProgress> {
  const courses = await getResolvedCourses(consultantUserId);
  const totalCourses = courses.length;
  const totalVideos = courses.reduce((sum, c) => sum + c.videoCount, 0);
  const completedVideos = courses.reduce((sum, c) => sum + c.completedVideoCount, 0);
  const pendingVideos = totalVideos - completedVideos;
  const completionPercentage = totalVideos === 0 ? 0 : Math.round((completedVideos / totalVideos) * 100);

  const lastCompletion = await prisma.videoCompletion.findFirst({
    where: { consultantUserId },
    orderBy: { completedAt: "desc" },
    include: { video: { select: { title: true } } },
  });

  return {
    totalCourses,
    totalVideos,
    completedVideos,
    pendingVideos,
    completionPercentage,
    lastCompletedVideoTitle: lastCompletion?.video.title ?? null,
    lastCompletedAt: lastCompletion?.completedAt ?? null,
  };
}

/**
 * Batched equivalent of getConsultantProgress for reports.ts's list-of-many
 * call sites (getDashboardAggregates/getConsultantReportRows), which would
 * otherwise call getConsultantProgress once per consultant (~5 queries each,
 * ~3,500 queries at 700 users). Five total queries regardless of N. Not used
 * by any single-consultant caller (own dashboard, per-consultant detail
 * page, /my-courses) — those keep using getConsultantProgress unchanged.
 */
export async function getConsultantProgressBatch(
  consultantUserIds: string[]
): Promise<Map<string, ConsultantProgress>> {
  const result = new Map<string, ConsultantProgress>();
  if (consultantUserIds.length === 0) return result;

  const assignments = await prisma.consultantTrainingAssignment.findMany({
    where: { consultantUserId: { in: consultantUserIds } },
    select: { consultantUserId: true, trainingPathId: true },
  });
  const pathIdByConsultant = new Map(assignments.map((a) => [a.consultantUserId, a.trainingPathId]));
  const distinctPathIds = [...new Set(assignments.map((a) => a.trainingPathId))];

  const [pathCourses, extraCourses] = await Promise.all([
    distinctPathIds.length > 0
      ? prisma.trainingPathCourse.findMany({
          where: { trainingPathId: { in: distinctPathIds }, course: { status: "ACTIVE" } },
          select: { trainingPathId: true, courseId: true },
        })
      : Promise.resolve([]),
    prisma.consultantExtraCourse.findMany({
      where: { consultantUserId: { in: consultantUserIds }, course: { status: "ACTIVE" } },
      select: { consultantUserId: true, courseId: true },
    }),
  ]);

  const courseIdsByPath = new Map<string, string[]>();
  for (const pc of pathCourses) {
    const list = courseIdsByPath.get(pc.trainingPathId) ?? [];
    list.push(pc.courseId);
    courseIdsByPath.set(pc.trainingPathId, list);
  }
  const extraCourseIdsByConsultant = new Map<string, string[]>();
  for (const ec of extraCourses) {
    const list = extraCourseIdsByConsultant.get(ec.consultantUserId) ?? [];
    list.push(ec.courseId);
    extraCourseIdsByConsultant.set(ec.consultantUserId, list);
  }

  const resolvedCourseIdsByConsultant = new Map<string, string[]>();
  const allCourseIds = new Set<string>();
  for (const consultantUserId of consultantUserIds) {
    const pathId = pathIdByConsultant.get(consultantUserId);
    const fromPath = pathId ? (courseIdsByPath.get(pathId) ?? []) : [];
    const fromExtra = extraCourseIdsByConsultant.get(consultantUserId) ?? [];
    const resolved = [...new Set([...fromPath, ...fromExtra])];
    resolvedCourseIdsByConsultant.set(consultantUserId, resolved);
    for (const id of resolved) allCourseIds.add(id);
  }

  const courseVideos =
    allCourseIds.size > 0
      ? await prisma.courseVideo.findMany({
          where: { courseId: { in: [...allCourseIds] }, video: { status: "ACTIVE" } },
          select: { courseId: true, videoId: true },
        })
      : [];
  const videoIdsByCourse = new Map<string, string[]>();
  for (const cv of courseVideos) {
    const list = videoIdsByCourse.get(cv.courseId) ?? [];
    list.push(cv.videoId);
    videoIdsByCourse.set(cv.courseId, list);
  }

  const completions = await prisma.videoCompletion.findMany({
    where: { consultantUserId: { in: consultantUserIds } },
    orderBy: { completedAt: "desc" },
    include: { video: { select: { title: true } } },
  });
  const completedVideoIdsByConsultant = new Map<string, Set<string>>();
  const latestCompletionByConsultant = new Map<
    string,
    { videoTitle: string; completedAt: Date }
  >();
  for (const completion of completions) {
    const set = completedVideoIdsByConsultant.get(completion.consultantUserId) ?? new Set<string>();
    set.add(completion.videoId);
    completedVideoIdsByConsultant.set(completion.consultantUserId, set);
    // completions is globally ordered by completedAt desc, so the first row
    // seen per consultant is their latest — replicates findFirst semantics
    // without a second query.
    if (!latestCompletionByConsultant.has(completion.consultantUserId)) {
      latestCompletionByConsultant.set(completion.consultantUserId, {
        videoTitle: completion.video.title,
        completedAt: completion.completedAt,
      });
    }
  }

  for (const consultantUserId of consultantUserIds) {
    const resolvedCourseIds = resolvedCourseIdsByConsultant.get(consultantUserId) ?? [];
    const completedVideoIds = completedVideoIdsByConsultant.get(consultantUserId) ?? new Set<string>();

    let totalVideos = 0;
    let completedVideos = 0;
    for (const courseId of resolvedCourseIds) {
      const videoIds = videoIdsByCourse.get(courseId) ?? [];
      totalVideos += videoIds.length;
      for (const videoId of videoIds) {
        if (completedVideoIds.has(videoId)) completedVideos += 1;
      }
    }
    const pendingVideos = totalVideos - completedVideos;
    const completionPercentage = totalVideos === 0 ? 0 : Math.round((completedVideos / totalVideos) * 100);
    const latest = latestCompletionByConsultant.get(consultantUserId);

    result.set(consultantUserId, {
      totalCourses: resolvedCourseIds.length,
      totalVideos,
      completedVideos,
      pendingVideos,
      completionPercentage,
      lastCompletedVideoTitle: latest?.videoTitle ?? null,
      lastCompletedAt: latest?.completedAt ?? null,
    });
  }

  return result;
}
