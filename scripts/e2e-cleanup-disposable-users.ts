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
  const { count } = await prisma.user.deleteMany({ where: { usernameLower: { startsWith: "e2e-" } } });
  console.log(`e2e cleanup: deleted ${count} disposable user(s).`);
}

main()
  .catch((err) => {
    console.error("e2e cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
