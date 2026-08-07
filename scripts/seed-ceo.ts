/**
 * One-time bootstrap: creates the first CEO account since the app has no
 * self-registration and no other admin exists yet to create one from the UI.
 *
 * Usage:
 *   CEO_USERNAME=... CEO_PASSWORD=... CEO_FIRST_NAME=... CEO_LAST_NAME=... \
 *     npx tsx scripts/seed-ceo.ts
 *
 * Safe to re-run: if a CEO with this username already exists, it does nothing.
 */
import { prisma } from "../src/lib/prisma";
import { hashPassword, validatePasswordStrength } from "../src/lib/auth/password";

async function main() {
  const username = process.env.CEO_USERNAME;
  const password = process.env.CEO_PASSWORD;
  const firstName = process.env.CEO_FIRST_NAME ?? "CEO";
  const lastName = process.env.CEO_LAST_NAME ?? "Admin";

  if (!username || !password) {
    console.error("CEO_USERNAME and CEO_PASSWORD environment variables are required.");
    process.exit(1);
  }

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    console.error(`Refusing to seed CEO account: ${strength.reason}`);
    process.exit(1);
  }

  const usernameLower = username.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { usernameLower } });
  if (existing) {
    console.log(`User '${username}' already exists (role: ${existing.role}). No changes made.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      role: "CEO",
      firstName,
      lastName,
      username,
      usernameLower,
      passwordHash,
      status: "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actionType: "USER_CREATED",
      targetEntityType: "User",
      targetEntityId: user.id,
      targetUserId: user.id,
      metadataJson: { seeded: true, role: "CEO" },
    },
  });

  console.log(`CEO account created: ${username} (id: ${user.id})`);
  console.log("Change this password immediately after first login.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
