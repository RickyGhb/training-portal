import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canCreateForm, formsListWhereClause, isCeo } from "@/lib/auth/rbac";
import { StatusBadge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { CreateFormForm } from "./create-form-form";
import { FormRowActions } from "./form-row-actions";

export default async function FormsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (!canCreateForm(actor.role)) redirect("/dashboard");

  const forms = await prisma.form.findMany({
    where: formsListWhereClause(actor),
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { firstName: true, lastName: true, role: true } },
      _count: { select: { submissions: true } },
    },
  });

  return (
    <div>
      <h1 className="page-title">Forms</h1>
      <p className="page-subtitle">
        Build a public form to collect responses — anyone with the link can fill it out, no login required.
      </p>

      <div className="mt-6">
        <CreateFormForm />
      </div>

      <table className="mt-6 table-shell">
        <thead>
          <tr>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Created by</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Responses</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {forms.map((form) => {
            const canEdit = actor.id === form.createdByUserId || isCeo(actor.role);
            return (
              <tr key={form.id}>
                <td className="px-4 py-2 font-medium text-[var(--color-ink)]">
                  <Link href={`/forms/${form.id}/${canEdit ? "edit" : "submissions"}`} className="hover:underline">
                    {form.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">
                  {form.createdBy ? `${form.createdBy.firstName} ${form.createdBy.lastName} (${ROLE_LABELS[form.createdBy.role]})` : "—"}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={form.status} />
                </td>
                <td className="px-4 py-2 text-[var(--color-ink-soft)]">{form._count.submissions}</td>
                <td className="px-4 py-2">
                  <FormRowActions
                    id={form.id}
                    title={form.title}
                    status={form.status}
                    submissionCount={form._count.submissions}
                    canEdit={canEdit}
                  />
                </td>
              </tr>
            );
          })}
          {forms.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                No forms yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
