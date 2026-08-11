import { describe, it, expect, vi, beforeEach } from "vitest";

const assignmentFindUniqueMock = vi.fn();
const assignmentFindManyMock = vi.fn();
const trainingPathCourseFindManyMock = vi.fn();
const consultantExtraCourseFindManyMock = vi.fn();
const courseVideoFindManyMock = vi.fn();
const videoCompletionFindManyMock = vi.fn();
const videoCompletionFindFirstMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    consultantTrainingAssignment: { findUnique: assignmentFindUniqueMock, findMany: assignmentFindManyMock },
    trainingPathCourse: { findMany: trainingPathCourseFindManyMock },
    consultantExtraCourse: { findMany: consultantExtraCourseFindManyMock },
    courseVideo: { findMany: courseVideoFindManyMock },
    videoCompletion: { findMany: videoCompletionFindManyMock, findFirst: videoCompletionFindFirstMock },
  },
}));

function course(id: string, name = id) {
  return { id, name, description: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  assignmentFindUniqueMock.mockResolvedValue(null);
  assignmentFindManyMock.mockResolvedValue([]);
  trainingPathCourseFindManyMock.mockResolvedValue([]);
  consultantExtraCourseFindManyMock.mockResolvedValue([]);
  courseVideoFindManyMock.mockResolvedValue([]);
  videoCompletionFindManyMock.mockResolvedValue([]);
  videoCompletionFindFirstMock.mockResolvedValue(null);
});

describe("getResolvedCourses union merge", () => {
  it("a course present only via the training path is tagged source: 'path'", async () => {
    assignmentFindUniqueMock.mockResolvedValue({ trainingPathId: "path-1" });
    trainingPathCourseFindManyMock.mockResolvedValue([{ course: course("course-a") }]);

    const { getResolvedCourses } = await import("@/lib/content-resolution");
    const result = await getResolvedCourses("consultant-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "course-a", source: "path" });
  });

  it("a course present only via extra assignment is tagged source: 'extra'", async () => {
    consultantExtraCourseFindManyMock.mockResolvedValue([{ course: course("course-b") }]);

    const { getResolvedCourses } = await import("@/lib/content-resolution");
    const result = await getResolvedCourses("consultant-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "course-b", source: "extra" });
  });

  it("a course present in both the path AND extra assignment is tagged source: 'both', not duplicated", async () => {
    assignmentFindUniqueMock.mockResolvedValue({ trainingPathId: "path-1" });
    trainingPathCourseFindManyMock.mockResolvedValue([{ course: course("course-c") }]);
    consultantExtraCourseFindManyMock.mockResolvedValue([{ course: course("course-c") }]);

    const { getResolvedCourses } = await import("@/lib/content-resolution");
    const result = await getResolvedCourses("consultant-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "course-c", source: "both" });
  });

  it("counts videos and completions per course correctly", async () => {
    consultantExtraCourseFindManyMock.mockResolvedValue([{ course: course("course-d") }]);
    courseVideoFindManyMock.mockResolvedValue([
      { courseId: "course-d", videoId: "vid-1" },
      { courseId: "course-d", videoId: "vid-2" },
    ]);
    videoCompletionFindManyMock.mockResolvedValue([{ videoId: "vid-1" }]);

    const { getResolvedCourses } = await import("@/lib/content-resolution");
    const result = await getResolvedCourses("consultant-1");

    expect(result[0]).toMatchObject({ videoCount: 2, completedVideoCount: 1 });
  });
});

describe("getConsultantProgress percentage math", () => {
  it("returns 0% (not NaN) when totalVideos is 0", async () => {
    const { getConsultantProgress } = await import("@/lib/content-resolution");
    const result = await getConsultantProgress("consultant-1");

    expect(result.totalVideos).toBe(0);
    expect(result.completionPercentage).toBe(0);
    expect(Number.isNaN(result.completionPercentage)).toBe(false);
  });

  it("rounds the completion percentage", async () => {
    consultantExtraCourseFindManyMock.mockResolvedValue([{ course: course("course-e") }]);
    courseVideoFindManyMock.mockResolvedValue([
      { courseId: "course-e", videoId: "vid-1" },
      { courseId: "course-e", videoId: "vid-2" },
      { courseId: "course-e", videoId: "vid-3" },
    ]);
    videoCompletionFindManyMock.mockResolvedValue([{ videoId: "vid-1" }]); // 1/3 = 33.33...%

    const { getConsultantProgress } = await import("@/lib/content-resolution");
    const result = await getConsultantProgress("consultant-1");

    expect(result.completionPercentage).toBe(33);
  });

  it("surfaces the most recent completion's video title and date", async () => {
    const completedAt = new Date("2026-08-01");
    videoCompletionFindFirstMock.mockResolvedValue({ completedAt, video: { title: "Intro to Testing" } });

    const { getConsultantProgress } = await import("@/lib/content-resolution");
    const result = await getConsultantProgress("consultant-1");

    expect(result.lastCompletedVideoTitle).toBe("Intro to Testing");
    expect(result.lastCompletedAt).toBe(completedAt);
  });
});

describe("getConsultantProgressBatch", () => {
  it("returns an empty map without querying anything for an empty id list", async () => {
    const { getConsultantProgressBatch } = await import("@/lib/content-resolution");
    const result = await getConsultantProgressBatch([]);

    expect(result.size).toBe(0);
    expect(assignmentFindManyMock).not.toHaveBeenCalled();
  });

  it("matches getConsultantProgress for a mix of path, extra, and shared courses across consultants", async () => {
    // consultant-1: path-1 -> course-a (2 videos, 1 completed) + extra course-b (1 video, completed)
    // consultant-2: no assignment, extra course-b only (shared with consultant-1, but own completions)
    assignmentFindManyMock.mockResolvedValue([{ consultantUserId: "consultant-1", trainingPathId: "path-1" }]);
    trainingPathCourseFindManyMock.mockResolvedValue([{ trainingPathId: "path-1", courseId: "course-a" }]);
    consultantExtraCourseFindManyMock.mockResolvedValue([
      { consultantUserId: "consultant-1", courseId: "course-b" },
      { consultantUserId: "consultant-2", courseId: "course-b" },
    ]);
    courseVideoFindManyMock.mockResolvedValue([
      { courseId: "course-a", videoId: "vid-1" },
      { courseId: "course-a", videoId: "vid-2" },
      { courseId: "course-b", videoId: "vid-3" },
    ]);
    const completedAt1 = new Date("2026-08-02");
    const completedAt2 = new Date("2026-08-01");
    videoCompletionFindManyMock.mockResolvedValue([
      { consultantUserId: "consultant-1", videoId: "vid-1", completedAt: completedAt1, video: { title: "Video 1" } },
      { consultantUserId: "consultant-1", videoId: "vid-3", completedAt: completedAt2, video: { title: "Video 3" } },
      { consultantUserId: "consultant-2", videoId: "vid-3", completedAt: completedAt2, video: { title: "Video 3" } },
    ]);

    const { getConsultantProgressBatch } = await import("@/lib/content-resolution");
    const result = await getConsultantProgressBatch(["consultant-1", "consultant-2"]);

    expect(result.get("consultant-1")).toMatchObject({
      totalCourses: 2,
      totalVideos: 3,
      completedVideos: 2,
      pendingVideos: 1,
      completionPercentage: 67,
      lastCompletedVideoTitle: "Video 1",
      lastCompletedAt: completedAt1,
    });
    expect(result.get("consultant-2")).toMatchObject({
      totalCourses: 1,
      totalVideos: 1,
      completedVideos: 1,
      pendingVideos: 0,
      completionPercentage: 100,
      lastCompletedVideoTitle: "Video 3",
      lastCompletedAt: completedAt2,
    });
  });

  it("returns 0% (not NaN) for a consultant with no resolved courses", async () => {
    const { getConsultantProgressBatch } = await import("@/lib/content-resolution");
    const result = await getConsultantProgressBatch(["consultant-3"]);

    expect(result.get("consultant-3")).toMatchObject({
      totalCourses: 0,
      totalVideos: 0,
      completionPercentage: 0,
    });
  });
});
