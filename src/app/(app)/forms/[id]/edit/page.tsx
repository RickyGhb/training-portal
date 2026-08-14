import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isCeo } from "@/lib/auth/rbac";
import { EditDetailsForm } from "./edit-details-form";
import { CopyLinkButton } from "./copy-link-button";
import { FieldRow } from "./field-row";
import { AddFieldButton } from "./add-field-button";
import { AccessGrantPanel } from "./access-grant-panel";

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      fields: { include: { options: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
      accessGrants: { include: { grantedTo: { select: { username: true, firstName: true, lastName: true, role: true } } } },
    },
  });
  if (!form) notFound();
  if (actor.id !== form.createdByUserId && !isCeo(actor.role)) redirect("/forms");

  return (
    <div>
      <Link href="/forms" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        ← Forms
      </Link>
      <h1 className="page-title mt-2">{form.title}</h1>
      <p className="page-subtitle">Build and share this form. Anyone with the public link can respond without logging in.</p>

      <div className="mt-4 flex items-center gap-4">
        <CopyLinkButton slug={form.slug} />
        <Link href={`/forms/${form.id}/submissions`} className="link-action">
          View responses
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Details</h2>
      <div className="mt-3">
        <EditDetailsForm formId={form.id} title={form.title} description={form.description} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Questions</h2>
        <AddFieldButton formId={form.id} />
      </div>
      <div className="mt-3 space-y-2">
        {form.fields.length === 0 && <p className="text-sm text-[var(--color-ink-faint)]">No questions yet.</p>}
        {form.fields.map((field, i) => (
          <FieldRow
            key={field.id}
            formId={form.id}
            field={field}
            isFirst={i === 0}
            isLast={i === form.fields.length - 1}
          />
        ))}
      </div>

      <div className="mt-8">
        <AccessGrantPanel
          formId={form.id}
          grants={form.accessGrants.map((g) => ({
            id: g.id,
            username: g.grantedTo.username,
            firstName: g.grantedTo.firstName,
            lastName: g.grantedTo.lastName,
            role: g.grantedTo.role,
          }))}
        />
      </div>
    </div>
  );
}
