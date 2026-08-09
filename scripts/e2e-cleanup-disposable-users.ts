/**
 * Deletes every user whose username starts with "e2e-" — the disposable
 * accounts created by e2e/user-management.spec.ts. Run as a child process
 * from e2e/fixtures.ts rather than imported directly into the Playwright
 * test process, because the generated Prisma client uses `import.meta` and
 * only loads cleanly under tsx's loader (same reason scripts/seed-demo.ts
 * does its own local re-implementations instead of importing server-only
 * app modules).
 *
 * Usage:
 *   node --env-file=.env.local -r tsx/cjs scripts/e2e-cleanup-disposable-users.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const ids = (await prisma.user.findMany({ where: { usernameLower: { startsWith: "e2e-" } }, select: { id: true } })).map(
    (u) => u.id
  );

  // AuditLog/Notification/TrainerFeedback/OtterFeedback FKs to User are all
  // Restrict (no cascade) — must clear them before the user rows themselves.
  await prisma.trainerFeedback.deleteMany({
    where: { OR: [{ consultantUserId: { in: ids } }, { trainerUserId: { in: ids } }] },
  });
  await prisma.otterFeedback.deleteMany({
    where: { OR: [{ consultantUserId: { in: ids } }, { otterUserId: { in: ids } }] },
  });
  await prisma.notification.deleteMany({ where: { recipientUserId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { targetUserId: { in: ids } }] } });

  const { count } = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`e2e cleanup: deleted ${count} disposable user(s).`);
}

main()
  .catch((err) => {
    console.error("e2e cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
