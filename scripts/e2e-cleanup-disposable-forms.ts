/**
 * Deletes every form whose title starts with "E2E Form " — the disposable
 * forms created by e2e/forms.spec.ts. Must run BEFORE
 * e2e-cleanup-disposable-users.ts in any given test's cleanup: a form with a
 * submitted answer can't be hard-deleted via the app's own deleteFormAction
 * (FormAnswer.fieldId is Restrict, see src/app/(app)/forms/actions.ts), and
 * FormAccessGrant.grantedToUserId/grantedByUserId are also Restrict — so a
 * disposable user still referenced by a grant on one of these forms would
 * block e2e-cleanup-disposable-users.ts's user delete. Deleting in explicit
 * dependency order here sidesteps both.
 *
 * Usage:
 *   node --env-file=.env.local -r tsx/cjs scripts/e2e-cleanup-disposable-forms.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const forms = await prisma.form.findMany({ where: { title: { startsWith: "E2E Form " } }, select: { id: true } });
  const formIds = forms.map((f) => f.id);
  if (formIds.length === 0) {
    console.log("e2e forms cleanup: nothing to do.");
    return;
  }

  const submissions = await prisma.formSubmission.findMany({
    where: { formId: { in: formIds } },
    select: { id: true },
  });
  const submissionIds = submissions.map((s) => s.id);

  await prisma.formFileUpload.deleteMany({ where: { submissionId: { in: submissionIds } } });
  await prisma.formAnswer.deleteMany({ where: { submissionId: { in: submissionIds } } });
  await prisma.formSubmission.deleteMany({ where: { id: { in: submissionIds } } });

  const fields = await prisma.formField.findMany({ where: { formId: { in: formIds } }, select: { id: true } });
  await prisma.formFieldOption.deleteMany({ where: { fieldId: { in: fields.map((f) => f.id) } } });
  await prisma.formField.deleteMany({ where: { formId: { in: formIds } } });

  await prisma.formAccessGrant.deleteMany({ where: { formId: { in: formIds } } });
  await prisma.auditLog.deleteMany({ where: { formId: { in: formIds } } });

  const { count } = await prisma.form.deleteMany({ where: { id: { in: formIds } } });
  console.log(`e2e forms cleanup: deleted ${count} disposable form(s).`);
}

main()
  .catch((err) => {
    console.error("e2e forms cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
