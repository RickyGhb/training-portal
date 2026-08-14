import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TECHNOLOGY_OPTIONS } from "@/lib/technologyOptions";
import { PublicForm } from "./public-form";

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const form = await prisma.form.findUnique({
    where: { slug },
    include: {
      fields: { include: { options: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!form || form.status !== "ACTIVE") notFound();

  const locations = await prisma.location.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const fields = form.fields.map((field) => ({
    id: field.id,
    label: field.label,
    helpText: field.helpText,
    type: field.type,
    required: field.required,
    maxFiles: field.maxFiles,
    maxFileSizeMb: field.maxFileSizeMb,
    options:
      field.optionsSource === "LOCATIONS"
        ? locations.map((l) => ({ value: l.id, label: l.name }))
        : field.optionsSource === "TECHNOLOGIES"
          ? TECHNOLOGY_OPTIONS.map((t) => ({ value: t.value, label: t.value }))
          : field.options.map((o) => ({ value: o.label, label: o.label })),
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="card">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          {form.title}
        </h1>
        {form.description && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{form.description}</p>}
      </div>
      <div className="mt-6">
        <PublicForm slug={slug} fields={fields} />
      </div>
    </div>
  );
}
