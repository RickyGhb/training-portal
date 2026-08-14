import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canViewForm, type FormCreatorSubject } from "@/lib/auth/rbac";
import { SubmissionRow } from "./submission-row";

const LOCATION_SCOPED_ROLES = new Set(["LOCATION_MANAGER", "LOCATION_ADMIN", "COORDINATOR"]);

export default async function FormSubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      createdBy: { select: { role: true, locationId: true, offshoreOffice: true } },
      accessGrants: { select: { grantedToUserId: true } },
    },
  });
  if (!form) notFound();

  const creator: FormCreatorSubject | null = form.createdBy
    ? { role: form.createdBy.role, locationId: form.createdBy.locationId, offshoreOffice: form.createdBy.offshoreOffice }
    : null;
  const hasGrant = form.accessGrants.some((g) => g.grantedToUserId === actor.id);
  const hasFullAccess = canViewForm(actor, form, creator, hasGrant);
  const isLocationScoped = LOCATION_SCOPED_ROLES.has(actor.role);

  if (!hasFullAccess && !(isLocationScoped && actor.locationId)) {
    redirect("/forms");
  }

  const submissions = await prisma.formSubmission.findMany({
    where: hasFullAccess ? { formId: form.id } : { formId: form.id, locationId: actor.locationId },
    orderBy: { submittedAt: "desc" },
    include: {
      location: { select: { name: true } },
      answers: { include: { field: { select: { label: true, type: true, optionsSource: true } } } },
      files: { include: { field: { select: { label: true } } } },
    },
  });

  // Dropdown answers bound to the live Locations list store the Location's id
  // as valueText (needed to resolve locationId for Mechanism B) — resolve it
  // back to a readable name here rather than showing a raw cuid.
  const locationIds = new Set(
    submissions.flatMap((s) => s.answers.filter((a) => a.field.optionsSource === "LOCATIONS" && a.valueText).map((a) => a.valueText!))
  );
  const locationNamesById = locationIds.size
    ? Object.fromEntries(
        (await prisma.location.findMany({ where: { id: { in: [...locationIds] } }, select: { id: true, name: true } })).map(
          (l) => [l.id, l.name]
        )
      )
    : {};

  return (
    <div>
      <Link href="/forms" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        ← Forms
      </Link>
      <h1 className="page-title mt-2">{form.title}</h1>
      <p className="page-subtitle">
        {submissions.length} response{submissions.length === 1 ? "" : "s"}
        {!hasFullAccess && " (scoped to your location)"}
      </p>

      <div className="mt-6 space-y-2">
        {submissions.length === 0 && <p className="text-sm text-[var(--color-ink-faint)]">No responses yet.</p>}
        {submissions.map((s) => (
          <SubmissionRow
            key={s.id}
            submittedAt={s.submittedAt.toLocaleString()}
            locationName={s.location?.name ?? null}
            answers={s.answers.map((a) => ({
              fieldLabel: a.field.label,
              fieldType: a.field.type,
              valueText:
                a.field.optionsSource === "LOCATIONS" && a.valueText
                  ? (locationNamesById[a.valueText] ?? a.valueText)
                  : a.valueText,
              valueJson: a.valueJson,
            }))}
            files={s.files.map((f) => ({ id: f.id, fileName: f.fileName, fieldLabel: f.field.label }))}
          />
        ))}
      </div>
    </div>
  );
}
