/**
 * Demo data seed — populates a small, coherent org (locations, full role
 * hierarchy, catalog, progress, audit/notifications) so every page has
 * something real to show. Additive only: never touches CEOAdmin/SriniAdmin,
 * and reuses the existing "Onboarding Essentials" course instead of
 * duplicating it. Safe to re-run — everything is keyed by a stable
 * identifier (usernameLower, Location.code, Video.driveFileId, etc.) and
 * upserted.
 *
 * Usage:
 *   node --env-file=.env.local -r tsx/cjs scripts/seed-demo.ts
 */
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";
import type { AuditActionType, NotificationType, Prisma, Role, UserStatus } from "../src/generated/prisma/client";

const DEMO_PASSWORD = "Demo#2026!";

/**
 * Local copies of src/lib/drive.ts#parseDriveLink and src/lib/audit.ts's
 * logAudit/notifyCeos. Those modules `import "server-only"`, which throws
 * unconditionally under plain Node/tsx execution (the conditional-empty-
 * module swap only happens inside a bundler) — so this script can't import
 * them directly. Logic here is kept identical to the originals.
 */
const DRIVE_FILE_ID_PATTERNS = [/\/file\/d\/([a-zA-Z0-9_-]{10,})/, /[?&]id=([a-zA-Z0-9_-]{10,})/];

function parseDriveLink(rawUrl: string): { valid: true; fileId: string; embedUrl: string } | { valid: false; error: string } {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "That doesn't look like a valid URL." };
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "drive.google.com") {
    return { valid: false, error: "Link must be a drive.google.com file link." };
  }
  for (const pattern of DRIVE_FILE_ID_PATTERNS) {
    const match = `${url.pathname}${url.search}`.match(pattern);
    if (match?.[1]) {
      const fileId = match[1];
      return { valid: true, fileId, embedUrl: `https://drive.google.com/file/d/${fileId}/preview` };
    }
  }
  return { valid: false, error: "Couldn't find a file ID in that link." };
}

async function logAudit(input: {
  actorUserId: string | null;
  actionType: AuditActionType;
  targetEntityType: string;
  targetEntityId?: string | null;
  targetUserId?: string | null;
  locationId?: string | null;
  trainingPathId?: string | null;
  courseId?: string | null;
  videoId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actionType: input.actionType,
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId,
      targetUserId: input.targetUserId,
      locationId: input.locationId,
      trainingPathId: input.trainingPathId,
      courseId: input.courseId,
      videoId: input.videoId,
      metadataJson: input.metadata,
    },
  });
}

async function notifyCeos(params: { type: NotificationType; title: string; body: string; sourceAuditLogId: string }) {
  const ceos = await prisma.user.findMany({ where: { role: "CEO", status: "ACTIVE", deletedAt: null }, select: { id: true } });
  if (ceos.length === 0) return;
  await prisma.notification.createMany({
    data: ceos.map((c) => ({
      recipientUserId: c.id,
      type: params.type,
      title: params.title,
      body: params.body,
      sourceAuditLogId: params.sourceAuditLogId,
    })),
  });
}

// Filename: Drive share URL, as pasted by the user. Only the first 24 are
// used (4 per course x 6 courses) — plenty for a realistic-looking catalog.
const DRIVE_LINKS: [string, string][] = [
  ["28-Apr-Net1.mp4", "https://drive.google.com/file/d/15CThpVLC4tAJwpvnivRKIU-Bb_yPgywo/view?usp=drive_web"],
  ["29-Apr-Net2.mp4", "https://drive.google.com/file/d/1xxYSJd4V6p5hiJk45ByS3LkfNrwV0Hil/view?usp=drive_web"],
  ["30-Apr-Net3.mp4", "https://drive.google.com/file/d/1157Ryt7oNCK3S3uT_ZGDYicuzBsmCQ4t/view?usp=drive_web"],
  ["03-May-Net4.mp4", "https://drive.google.com/file/d/1D97zwllpuKyZvZ7bGSIbD2AEYkbS9CTw/view?usp=drive_web"],
  ["05-May-Net5.mp4", "https://drive.google.com/file/d/1hosEIPHFgtMYCirteK5A4HrM9MHFfoMe/view?usp=drive_web"],
  ["06-May-Net6.mp4", "https://drive.google.com/file/d/1VL5XMI-rGJgHCYfjdUILjdI8Z46YT2-D/view?usp=drive_web"],
  ["07-May-Net7.mp4", "https://drive.google.com/file/d/1kP5pDF8tQ04U82WNvPPI_266Ea56wpPz/view?usp=drive_web"],
  ["08-May-Net8.mp4", "https://drive.google.com/file/d/1Ag26dvCgmaEJQCTL5IN4iEZWvdQdC1mo/view?usp=drive_web"],
  ["09-May-Net9.mp4", "https://drive.google.com/file/d/1PuY3BliTc9Mb6CwRYgRch8PzCArPouDy/view?usp=drive_web"],
  ["10-May-Net10.mp4", "https://drive.google.com/file/d/1OPpKhrd8WnQgqsH94VILe9VRvRoO-jhu/view?usp=drive_web"],
  ["12-May-Net11.mp4", "https://drive.google.com/file/d/1Cc2q0LMoQY08RdYgxEOKqX5cuPz2mjWr/view?usp=drive_web"],
  ["13-May-Net12.mp4", "https://drive.google.com/file/d/1dUC695LYNdSi-iQ5VZogCxZ5A-xFVdd-/view?usp=drive_web"],
  ["15-May-Net13.mp4", "https://drive.google.com/file/d/14yxM7uJ85cjhbyNQDwHmdeLPfRo6Wwui/view?usp=drive_web"],
  ["16-May-Net14.mp4", "https://drive.google.com/file/d/1dJXuISJcznDL-Za9wQXwpdpXCganHQwf/view?usp=drive_web"],
  ["17-May-Net15.mp4", "https://drive.google.com/file/d/15KVh2scU6lA-EKrS8DXhtSd1nb19B3JX/view?usp=drive_web"],
  ["21-May-Net16.mp4", "https://drive.google.com/file/d/1qaYNry1YELgu9gKmTYcVZRwqIKjMkj_a/view?usp=drive_web"],
  ["22-May.mp4", "https://drive.google.com/file/d/1bAz6iExIBNNrtMnhwoSs1ZBQ3dyIhKSx/view?usp=drive_web"],
  ["23-May.mp4", "https://drive.google.com/file/d/1dBVY3dhWaOurrq9ZvQWggRJmHq_thbaO/view?usp=drive_web"],
  ["24-May.mp4", "https://drive.google.com/file/d/1z7q4HKGe8ZHKZFIkaur8wtaH9CP1RQg-/view?usp=drive_web"],
  ["26-May.mp4", "https://drive.google.com/file/d/11wkG8GwbHu6aZ79yItN1x2dVFZrQqRwM/view?usp=drive_web"],
  ["28-May.mp4", "https://drive.google.com/file/d/1TTZZxOaFkuIXhlZ8RErq0qozx0y1LiLQ/view?usp=drive_web"],
  ["29-May.mp4", "https://drive.google.com/file/d/1yikMRedQ3ApYeapuDir7KYZDXBCiD8TE/view?usp=drive_web"],
  ["30-May.mp4", "https://drive.google.com/file/d/1o0SiapjbgLfThKs5tK5z_NN3F93qvZWi/view?usp=drive_web"],
  ["June2nd.mp4", "https://drive.google.com/file/d/1t3DD94vxrbPGNu0fdCbp71DyFSxZXCrn/view?usp=drive_web"],
];

type UserSeed = {
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
  status?: UserStatus;
  locationCode?: string;
  managerUsername?: string;
  locationManagerUsername?: string;
  coordinatorUsername?: string;
};

async function upsertUser(seed: UserSeed, passwordHash: string, createdByUserId: string | null) {
  const usernameLower = seed.username.toLowerCase();
  const locationId = seed.locationCode ? locationIdByCode[seed.locationCode] : null;
  const managerId = seed.managerUsername ? userIdByUsername[seed.managerUsername] : null;
  const locationManagerId = seed.locationManagerUsername ? userIdByUsername[seed.locationManagerUsername] : null;
  const coordinatorId = seed.coordinatorUsername ? userIdByUsername[seed.coordinatorUsername] : null;

  const user = await prisma.user.upsert({
    where: { usernameLower },
    update: {
      firstName: seed.firstName,
      lastName: seed.lastName,
      status: seed.status ?? "ACTIVE",
      locationId,
      managerId,
      locationManagerId,
      coordinatorId,
    },
    create: {
      role: seed.role,
      firstName: seed.firstName,
      lastName: seed.lastName,
      username: seed.username,
      usernameLower,
      passwordHash,
      status: seed.status ?? "ACTIVE",
      locationId,
      managerId,
      locationManagerId,
      coordinatorId,
      createdByUserId,
    },
  });

  userIdByUsername[seed.username] = user.id;

  await logAudit({
    actorUserId: createdByUserId,
    actionType: "USER_CREATED",
    targetEntityType: "User",
    targetEntityId: user.id,
    targetUserId: user.id,
    locationId: user.locationId,
    metadata: { role: seed.role, seeded: true },
  });

  return user;
}

const locationIdByCode: Record<string, string | null> = {};
const userIdByUsername: Record<string, string> = {};

async function main() {
  const demoPasswordHash = await hashPassword(DEMO_PASSWORD);

  // --- CEO: rename the existing tempadmin account, don't touch real CEOs ---
  const ceo = await prisma.user.findUnique({ where: { usernameLower: "tempadmin" } });
  if (!ceo) {
    console.error("Expected 'tempadmin' CEO account to already exist — aborting.");
    process.exit(1);
  }
  await prisma.user.update({
    where: { id: ceo.id },
    data: { firstName: "Reese", lastName: "Callahan", passwordHash: demoPasswordHash },
  });
  userIdByUsername["tempadmin"] = ceo.id;
  console.log(`CEO (demo login): tempadmin — renamed to Reese Callahan`);

  // --- Locations ---
  for (const loc of [
    { name: "Downtown Office", code: "DTO" },
    { name: "Riverside Office", code: "RVO" },
  ]) {
    const location = await prisma.location.upsert({
      where: { code: loc.code },
      update: { name: loc.name },
      create: { name: loc.name, code: loc.code, createdByUserId: ceo.id },
    });
    locationIdByCode[loc.code] = location.id;
    await logAudit({
      actorUserId: ceo.id,
      actionType: "LOCATION_CREATED",
      targetEntityType: "Location",
      targetEntityId: location.id,
      locationId: location.id,
      metadata: { seeded: true },
    });
  }
  console.log("Locations: Downtown Office (DTO), Riverside Office (RVO)");

  // --- Hierarchy ---
  await upsertUser({ username: "arivera", firstName: "Alex", lastName: "Rivera", role: "MANAGER" }, demoPasswordHash, ceo.id);

  await upsertUser(
    { username: "mlee", firstName: "Morgan", lastName: "Lee", role: "LOCATION_MANAGER", locationCode: "DTO", managerUsername: "arivera" },
    demoPasswordHash,
    ceo.id
  );
  await upsertUser(
    { username: "ckim", firstName: "Casey", lastName: "Kim", role: "LOCATION_MANAGER", locationCode: "RVO", managerUsername: "arivera" },
    demoPasswordHash,
    ceo.id
  );

  const coordinatorSeeds: UserSeed[] = [
    { username: "tbrooks", firstName: "Taylor", lastName: "Brooks", role: "COORDINATOR", locationCode: "DTO", locationManagerUsername: "mlee", managerUsername: "arivera" },
    { username: "jchen", firstName: "Jamie", lastName: "Chen", role: "COORDINATOR", locationCode: "DTO", locationManagerUsername: "mlee", managerUsername: "arivera" },
    { username: "rmorgan", firstName: "Riley", lastName: "Morgan", role: "COORDINATOR", locationCode: "RVO", locationManagerUsername: "ckim", managerUsername: "arivera" },
  ];
  for (const seed of coordinatorSeeds) await upsertUser(seed, demoPasswordHash, ceo.id);
  console.log("Demo Coordinator login: tbrooks (Taylor Brooks)");

  const consultantSeeds: (UserSeed & { completionTarget: number })[] = [
    { username: "spatel", firstName: "Sam", lastName: "Patel", role: "CONSULTANT", locationCode: "DTO", coordinatorUsername: "tbrooks", completionTarget: 0.9 },
    { username: "dnakamura", firstName: "Drew", lastName: "Nakamura", role: "CONSULTANT", locationCode: "DTO", coordinatorUsername: "tbrooks", completionTarget: 0.25 },
    { username: "jellis", firstName: "Jordan", lastName: "Ellis", role: "CONSULTANT", locationCode: "DTO", coordinatorUsername: "tbrooks", completionTarget: 0.6 },
    { username: "calvarez", firstName: "Casey", lastName: "Alvarez", role: "CONSULTANT", locationCode: "DTO", coordinatorUsername: "tbrooks", status: "DEACTIVATED", completionTarget: 0.2 },
    { username: "mito", firstName: "Morgan", lastName: "Ito", role: "CONSULTANT", locationCode: "DTO", coordinatorUsername: "jchen", completionTarget: 0.5 },
    { username: "rsantos", firstName: "Riley", lastName: "Santos", role: "CONSULTANT", locationCode: "DTO", coordinatorUsername: "jchen", completionTarget: 0.7 },
    { username: "akim", firstName: "Avery", lastName: "Kim", role: "CONSULTANT", locationCode: "DTO", coordinatorUsername: "jchen", completionTarget: 0.4 },
    { username: "qfischer", firstName: "Quinn", lastName: "Fischer", role: "CONSULTANT", locationCode: "DTO", coordinatorUsername: "jchen", completionTarget: 0.15 },
    { username: "hdiaz", firstName: "Harper", lastName: "Diaz", role: "CONSULTANT", locationCode: "RVO", coordinatorUsername: "rmorgan", completionTarget: 0.55 },
    { username: "rbailey", firstName: "Rowan", lastName: "Bailey", role: "CONSULTANT", locationCode: "RVO", coordinatorUsername: "rmorgan", completionTarget: 0.35 },
    { username: "swong", firstName: "Skyler", lastName: "Wong", role: "CONSULTANT", locationCode: "RVO", coordinatorUsername: "rmorgan", completionTarget: 0.8 },
    { username: "ecruz", firstName: "Emerson", lastName: "Cruz", role: "CONSULTANT", locationCode: "RVO", coordinatorUsername: "rmorgan", completionTarget: 0.65 },
  ];
  for (const seed of consultantSeeds) await upsertUser(seed, demoPasswordHash, ceo.id);

  // Soft-delete Quinn Fischer so the "Deleted (archived)" tile isn't zero.
  const qfischerId = userIdByUsername["qfischer"];
  await prisma.user.update({ where: { id: qfischerId }, data: { status: "DELETED", deletedAt: new Date() } });
  const deleteEntry = await logAudit({
    actorUserId: ceo.id,
    actionType: "USER_DELETED",
    targetEntityType: "User",
    targetEntityId: qfischerId,
    targetUserId: qfischerId,
    metadata: { seeded: true },
  });
  await notifyCeos({
    type: "USER_DELETED",
    title: "Consultant deleted",
    body: "Reese Callahan deleted consultant Quinn Fischer (qfischer).",
    sourceAuditLogId: deleteEntry.id,
  });

  console.log("Demo Consultant logins: spatel (Sam Patel, ~90% complete), dnakamura (Drew Nakamura, ~25% complete)");

  // --- Catalog: courses ---
  const courseNames = [
    "Onboarding Essentials", // reuse existing
    "Workplace Safety & Compliance",
    "Customer Communication Skills",
    "Sales Fundamentals",
    "Data Privacy & Security",
    "Leadership Basics", // extra-course only, not in any path
  ];
  const courseIdByName: Record<string, string> = {};
  for (const name of courseNames) {
    let course = await prisma.course.findFirst({ where: { name } });
    if (!course) {
      course = await prisma.course.create({ data: { name, createdByUserId: ceo.id } });
      await logAudit({
        actorUserId: ceo.id,
        actionType: "COURSE_CREATED",
        targetEntityType: "Course",
        targetEntityId: course.id,
        courseId: course.id,
        metadata: { seeded: true },
      });
    }
    courseIdByName[name] = course.id;
  }
  console.log(`Courses: ${courseNames.join(", ")}`);

  // --- Catalog: videos, 4 per course ---
  const videoIdsByCourse: Record<string, string[]> = {};
  let linkIndex = 0;
  for (const name of courseNames) {
    const videoIds: string[] = [];
    for (let session = 1; session <= 4; session++) {
      const [, url] = DRIVE_LINKS[linkIndex++];
      const parsed = parseDriveLink(url);
      if (!parsed.valid) {
        console.error(`Skipping unparseable Drive link for ${name} session ${session}: ${parsed.error}`);
        continue;
      }
      const video = await prisma.video.upsert({
        where: { driveFileId: parsed.fileId },
        update: {},
        create: {
          title: `${name} — Session ${session}`,
          driveSourceUrl: url,
          driveFileId: parsed.fileId,
          embedUrl: parsed.embedUrl,
          createdByUserId: ceo.id,
        },
      });
      videoIds.push(video.id);
      await logAudit({
        actorUserId: ceo.id,
        actionType: "VIDEO_CREATED",
        targetEntityType: "Video",
        targetEntityId: video.id,
        videoId: video.id,
        metadata: { seeded: true },
      });

      await prisma.courseVideo.upsert({
        where: { courseId_videoId: { courseId: courseIdByName[name], videoId: video.id } },
        update: { sortOrder: session },
        create: { courseId: courseIdByName[name], videoId: video.id, sortOrder: session },
      });
    }
    videoIdsByCourse[name] = videoIds;
  }
  console.log(`Videos: ${linkIndex} created/linked (4 per course)`);

  // --- Catalog: training paths ---
  const pathSeeds: { name: string; courseNames: string[] }[] = [
    { name: "New Hire Path", courseNames: ["Onboarding Essentials", "Workplace Safety & Compliance"] },
    { name: "Client-Facing Path", courseNames: ["Customer Communication Skills", "Sales Fundamentals"] },
    { name: "Security & Compliance Path", courseNames: ["Workplace Safety & Compliance", "Data Privacy & Security"] },
  ];
  const pathIdByName: Record<string, string> = {};
  for (const seed of pathSeeds) {
    let path = await prisma.trainingPath.findFirst({ where: { name: seed.name } });
    if (!path) {
      path = await prisma.trainingPath.create({ data: { name: seed.name, createdByUserId: ceo.id } });
      await logAudit({
        actorUserId: ceo.id,
        actionType: "TRAINING_PATH_CREATED",
        targetEntityType: "TrainingPath",
        targetEntityId: path.id,
        trainingPathId: path.id,
        metadata: { seeded: true },
      });
    }
    pathIdByName[seed.name] = path.id;
    for (let i = 0; i < seed.courseNames.length; i++) {
      const courseId = courseIdByName[seed.courseNames[i]];
      await prisma.trainingPathCourse.upsert({
        where: { trainingPathId_courseId: { trainingPathId: path.id, courseId } },
        update: { sortOrder: i },
        create: { trainingPathId: path.id, courseId, sortOrder: i },
      });
    }
  }
  console.log(`Training paths: ${pathSeeds.map((p) => p.name).join(", ")}`);

  // --- Assignments: primary training path per consultant, round-robin ---
  const pathNames = pathSeeds.map((p) => p.name);
  for (let i = 0; i < consultantSeeds.length; i++) {
    const seed = consultantSeeds[i];
    const consultantId = userIdByUsername[seed.username];
    const pathName = pathNames[i % pathNames.length];
    const pathId = pathIdByName[pathName];

    await prisma.consultantTrainingAssignment.upsert({
      where: { consultantUserId: consultantId },
      update: { trainingPathId: pathId },
      create: { consultantUserId: consultantId, trainingPathId: pathId, assignedByUserId: ceo.id },
    });
    await logAudit({
      actorUserId: ceo.id,
      actionType: "TRAINING_PATH_ASSIGNED",
      targetEntityType: "User",
      targetEntityId: consultantId,
      targetUserId: consultantId,
      trainingPathId: pathId,
      metadata: { seeded: true },
    });
  }

  // --- Extra course: Leadership Basics assigned to 3 consultants ---
  const extraCourseId = courseIdByName["Leadership Basics"];
  for (const username of ["spatel", "mito", "hdiaz"]) {
    const consultantId = userIdByUsername[username];
    await prisma.consultantExtraCourse.upsert({
      where: { consultantUserId_courseId: { consultantUserId: consultantId, courseId: extraCourseId } },
      update: {},
      create: { consultantUserId: consultantId, courseId: extraCourseId, assignedByUserId: ceo.id },
    });
    await logAudit({
      actorUserId: ceo.id,
      actionType: "EXTRA_COURSE_ASSIGNED",
      targetEntityType: "User",
      targetEntityId: consultantId,
      targetUserId: consultantId,
      courseId: extraCourseId,
      metadata: { seeded: true },
    });
  }
  console.log("Extra course (Leadership Basics) assigned to: spatel, mito, hdiaz");

  // --- Progress: VideoCompletion rows matching each consultant's target % ---
  for (const seed of consultantSeeds) {
    const consultantId = userIdByUsername[seed.username];
    const assignment = await prisma.consultantTrainingAssignment.findUnique({ where: { consultantUserId: consultantId } });
    if (!assignment) continue;
    const pathCourses = await prisma.trainingPathCourse.findMany({ where: { trainingPathId: assignment.trainingPathId } });
    const courseIds = pathCourses.map((pc) => pc.courseId);
    const extra = await prisma.consultantExtraCourse.findMany({ where: { consultantUserId: consultantId } });
    const allCourseIds = [...courseIds, ...extra.map((e) => e.courseId)];
    const courseVideos = await prisma.courseVideo.findMany({ where: { courseId: { in: allCourseIds } } });
    const videoIds = [...new Set(courseVideos.map((cv) => cv.videoId))];

    const completeCount = Math.round(videoIds.length * seed.completionTarget);
    const coordinatorId = seed.coordinatorUsername ? userIdByUsername[seed.coordinatorUsername] : null;

    for (let i = 0; i < completeCount; i++) {
      const daysAgo = 2 + i * 3; // spread completions over the last several weeks
      await prisma.videoCompletion.upsert({
        where: { consultantUserId_videoId: { consultantUserId: consultantId, videoId: videoIds[i] } },
        update: {},
        create: {
          consultantUserId: consultantId,
          videoId: videoIds[i],
          completedAt: new Date(Date.now() - daysAgo * 86400000),
          markedByUserId: i % 2 === 0 ? null : coordinatorId,
        },
      });
    }
  }
  console.log("Progress: video completions seeded per consultant's target completion %");

  // --- One extra notification for variety (report export) ---
  const reportExportEntry = await logAudit({
    actorUserId: userIdByUsername["arivera"],
    actionType: "REPORT_EXPORTED",
    targetEntityType: "Report",
    metadata: { seeded: true },
  });
  await notifyCeos({
    type: "REPORT_EXPORTED",
    title: "Report exported",
    body: "Alex Rivera exported a consultant progress report.",
    sourceAuditLogId: reportExportEntry.id,
  });

  console.log("\n=== Demo credentials (shared password) ===");
  console.log(`Password for all seeded accounts: ${DEMO_PASSWORD}`);
  console.log("CEO:         tempadmin   (Reese Callahan)");
  console.log("Coordinator: tbrooks     (Taylor Brooks)");
  console.log("Consultant (high progress ~90%): spatel     (Sam Patel)");
  console.log("Consultant (low progress ~25%):  dnakamura  (Drew Nakamura)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
