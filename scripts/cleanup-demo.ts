/**
 * Removes everything scripts/seed-demo.ts created, and resets the CEO
 * account's password (which seed-demo.ts overwrote with a shared demo
 * password). Matches records by their actual identity (usernames, location
 * codes, course/path names, video driveFileIds) rather than only the
 * `metadataJson: {seeded: true}` audit-log tag, since login events for the
 * demo accounts (written directly in src/app/login/actions.ts, bypassing
 * logAudit()) wouldn't carry that tag but would still FK-reference them and
 * block deletion.
 *
 * Defaults to a dry run (counts only, no writes). Pass --confirm to actually
 * delete.
 *
 * Usage:
 *   node --env-file=.env.local -r tsx/cjs scripts/cleanup-demo.ts            # dry run
 *   node --env-file=.env.local -r tsx/cjs scripts/cleanup-demo.ts --confirm  # execute
 */
import { randomBytes } from "crypto";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";

const DEMO_USERNAMES = [
  "arivera",
  "mlee",
  "ckim",
  "tbrooks",
  "jchen",
  "rmorgan",
  "spatel",
  "dnakamura",
  "jellis",
  "calvarez",
  "mito",
  "rsantos",
  "akim",
  "qfischer",
  "hdiaz",
  "rbailey",
  "swong",
  "ecruz",
];

// Leaf-to-root, so self-referential FKs (managerId/locationManagerId/coordinatorId) never block a delete.
const CONSULTANT_USERNAMES = [
  "spatel",
  "dnakamura",
  "jellis",
  "calvarez",
  "mito",
  "rsantos",
  "akim",
  "qfischer",
  "hdiaz",
  "rbailey",
  "swong",
  "ecruz",
];
const COORDINATOR_USERNAMES = ["tbrooks", "jchen", "rmorgan"];
const LOCATION_ADMIN_USERNAMES = ["mlee", "ckim"];
const LOCATION_MANAGER_USERNAMES = ["arivera"];

const DEMO_LOCATION_CODES = ["DTO", "RVO"];

const DEMO_COURSE_NAMES = [
  "Workplace Safety & Compliance",
  "Customer Communication Skills",
  "Sales Fundamentals",
  "Data Privacy & Security",
  "Leadership Basics",
];

const DEMO_TRAINING_PATH_NAMES = ["New Hire Path", "Client-Facing Path", "Security & Compliance Path"];

// Exact driveFileIds parsed from the DRIVE_LINKS urls in seed-demo.ts.
const DEMO_VIDEO_DRIVE_FILE_IDS = [
  "15CThpVLC4tAJwpvnivRKIU-Bb_yPgywo",
  "1xxYSJd4V6p5hiJk45ByS3LkfNrwV0Hil",
  "1157Ryt7oNCK3S3uT_ZGDYicuzBsmCQ4t",
  "1D97zwllpuKyZvZ7bGSIbD2AEYkbS9CTw",
  "1hosEIPHFgtMYCirteK5A4HrM9MHFfoMe",
  "1VL5XMI-rGJgHCYfjdUILjdI8Z46YT2-D",
  "1kP5pDF8tQ04U82WNvPPI_266Ea56wpPz",
  "1Ag26dvCgmaEJQCTL5IN4iEZWvdQdC1mo",
  "1PuY3BliTc9Mb6CwRYgRch8PzCArPouDy",
  "1OPpKhrd8WnQgqsH94VILe9VRvRoO-jhu",
  "1Cc2q0LMoQY08RdYgxEOKqX5cuPz2mjWr",
  "1dUC695LYNdSi-iQ5VZogCxZ5A-xFVdd-",
  "14yxM7uJ85cjhbyNQDwHmdeLPfRo6Wwui",
  "1dJXuISJcznDL-Za9wQXwpdpXCganHQwf",
  "15KVh2scU6lA-EKrS8DXhtSd1nb19B3JX",
  "1qaYNry1YELgu9gKmTYcVZRwqIKjMkj_a",
  "1bAz6iExIBNNrtMnhwoSs1ZBQ3dyIhKSx",
  "1dBVY3dhWaOurrq9ZvQWggRJmHq_thbaO",
  "1z7q4HKGe8ZHKZFIkaur8wtaH9CP1RQg-",
  "11wkG8GwbHu6aZ79yItN1x2dVFZrQqRwM",
  "1TTZZxOaFkuIXhlZ8RErq0qozx0y1LiLQ",
  "1yikMRedQ3ApYeapuDir7KYZDXBCiD8TE",
  "1o0SiapjbgLfThKs5tK5z_NN3F93qvZWi",
  "1t3DD94vxrbPGNu0fdCbp71DyFSxZXCrn",
];

function generatePassword(): string {
  return randomBytes(18).toString("base64url"); // 24 chars, well above the 10-char minimum
}

async function main() {
  const dryRun = !process.argv.includes("--confirm");

  const ceo = await prisma.user.findUnique({ where: { usernameLower: "tempadmin" } });
  if (!ceo) {
    console.error("Expected 'tempadmin' CEO account to exist — aborting.");
    process.exit(1);
  }

  const demoUsers = await prisma.user.findMany({
    where: { usernameLower: { in: DEMO_USERNAMES.map((u) => u.toLowerCase()) } },
    select: { id: true, usernameLower: true },
  });
  const demoUserIdByUsername: Record<string, string> = {};
  for (const u of demoUsers) demoUserIdByUsername[u.usernameLower] = u.id;
  const demoUserIds = demoUsers.map((u) => u.id);

  const demoLocations = await prisma.location.findMany({ where: { code: { in: DEMO_LOCATION_CODES } } });
  const demoLocationIds = demoLocations.map((l) => l.id);

  const demoCourses = await prisma.course.findMany({ where: { name: { in: DEMO_COURSE_NAMES } } });
  const demoCourseIds = demoCourses.map((c) => c.id);

  const demoVideos = await prisma.video.findMany({ where: { driveFileId: { in: DEMO_VIDEO_DRIVE_FILE_IDS } } });
  const demoVideoIds = demoVideos.map((v) => v.id);

  const demoTrainingPaths = await prisma.trainingPath.findMany({ where: { name: { in: DEMO_TRAINING_PATH_NAMES } } });
  const demoTrainingPathIds = demoTrainingPaths.map((p) => p.id);

  const auditLogWhere = {
    AND: [
      {
        OR: [
          { actorUserId: { in: demoUserIds } },
          { targetUserId: { in: demoUserIds } },
          { locationId: { in: demoLocationIds } },
          { courseId: { in: demoCourseIds } },
          { videoId: { in: demoVideoIds } },
          { trainingPathId: { in: demoTrainingPathIds } },
        ],
      },
      {
        NOT: { targetUserId: ceo.id, actionType: "USER_CREATED" as const },
      },
    ],
  };

  const auditLogIds = (await prisma.auditLog.findMany({ where: auditLogWhere, select: { id: true } })).map((a) => a.id);
  const notificationCount = await prisma.notification.count({ where: { sourceAuditLogId: { in: auditLogIds } } });

  console.log("=== Dry run — records that would be affected ===");
  console.log(`Locations (${DEMO_LOCATION_CODES.join(", ")}): ${demoLocations.length}`);
  console.log(`Users (${DEMO_USERNAMES.length} expected): ${demoUsers.length}`);
  console.log(`Courses: ${demoCourses.length} (of ${DEMO_COURSE_NAMES.length} expected)`);
  console.log(`Videos: ${demoVideos.length} (of ${DEMO_VIDEO_DRIVE_FILE_IDS.length} expected)`);
  console.log(`Training paths: ${demoTrainingPaths.length} (of ${DEMO_TRAINING_PATH_NAMES.length} expected)`);
  console.log(`Audit log rows: ${auditLogIds.length}`);
  console.log(`Notification rows (referencing those audit logs): ${notificationCount}`);
  console.log(`CEO account: ${ceo.username} — password will be reset, name left as-is.`);

  if (dryRun) {
    console.log("\nDry run only — nothing deleted. Re-run with --confirm to execute.");
    return;
  }

  const newPassword = generatePassword();
  const newPasswordHash = await hashPassword(newPassword);

  await prisma.$transaction(
    async (tx) => {
      await tx.notification.deleteMany({ where: { sourceAuditLogId: { in: auditLogIds } } });
      await tx.auditLog.deleteMany({ where: { id: { in: auditLogIds } } });

      const consultantIds = CONSULTANT_USERNAMES.map((u) => demoUserIdByUsername[u]).filter(Boolean);
      await tx.user.deleteMany({ where: { id: { in: consultantIds } } });

      const coordinatorIds = COORDINATOR_USERNAMES.map((u) => demoUserIdByUsername[u]).filter(Boolean);
      await tx.user.deleteMany({ where: { id: { in: coordinatorIds } } });

      const locationAdminIds = LOCATION_ADMIN_USERNAMES.map((u) => demoUserIdByUsername[u]).filter(Boolean);
      await tx.user.deleteMany({ where: { id: { in: locationAdminIds } } });

      const locationManagerIds = LOCATION_MANAGER_USERNAMES.map((u) => demoUserIdByUsername[u]).filter(Boolean);
      await tx.user.deleteMany({ where: { id: { in: locationManagerIds } } });

      await tx.video.deleteMany({ where: { id: { in: demoVideoIds } } });
      await tx.course.deleteMany({ where: { id: { in: demoCourseIds } } });
      await tx.trainingPath.deleteMany({ where: { id: { in: demoTrainingPathIds } } });
      await tx.location.deleteMany({ where: { id: { in: demoLocationIds } } });

      await tx.user.update({ where: { id: ceo.id }, data: { passwordHash: newPasswordHash } });
    },
    { timeout: 30000 }
  );

  console.log("\n=== Cleanup complete ===");
  console.log(`New CEO password for '${ceo.username}': ${newPassword}`);
  console.log("Save this now — it will not be shown again. Change it after logging in.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
