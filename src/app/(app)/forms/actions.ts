"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canCreateForm,
  canGrantFormAccess,
  canViewForm,
  canViewFormsByCreator,
  isCeo,
  type FormCreatorSubject,
} from "@/lib/auth/rbac";
import { formSchema, formFieldSchema, grantFormAccessSchema } from "@/lib/validation/forms";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/app/(app)/users/actions";

async function requireActor() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  return actor;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return (base || "form") + "-" + randomBytes(4).toString("hex");
}

/** Loads a Form + its creator's ScopeSubject fields, for RBAC checks. Returns null if not found. */
async function loadFormWithCreator(formId: string) {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: { createdBy: { select: { role: true, locationId: true, offshoreOffice: true } } },
  });
  if (!form) return null;
  const creator: FormCreatorSubject | null = form.createdBy
    ? { role: form.createdBy.role, locationId: form.createdBy.locationId, offshoreOffice: form.createdBy.offshoreOffice }
    : null;
  return { form, creator };
}

async function requireFormEditor(formId: string) {
  const actor = await requireActor();
  const loaded = await loadFormWithCreator(formId);
  if (!loaded) return { actor, form: null, error: "Form not found." };
  const { form } = loaded;
  const canEdit = actor.id === form.createdByUserId || isCeo(actor.role);
  if (!canEdit) return { actor, form: null, error: "You don't have permission to edit this form." };
  return { actor, form, error: null };
}

export async function createFormAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (!canCreateForm(actor.role)) return { error: "You don't have permission to create forms." };

  const parsed = formSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const form = await prisma.form.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      slug: slugify(parsed.data.title),
      createdByUserId: actor.id,
    },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "FORM_CREATED",
    targetEntityType: "Form",
    targetEntityId: form.id,
    formId: form.id,
    metadata: { title: form.title },
  });

  revalidatePath("/forms");
  redirect(`/forms/${form.id}/edit`);
}

export async function updateFormAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const formId = String(formData.get("formId") ?? "");
  const { actor, form, error } = await requireFormEditor(formId);
  if (error || !form) return { error: error ?? "Form not found." };

  const parsed = formSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.form.update({
    where: { id: formId },
    data: { title: parsed.data.title, description: parsed.data.description },
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "FORM_UPDATED",
    targetEntityType: "Form",
    targetEntityId: formId,
    formId,
  });

  revalidatePath("/forms");
  revalidatePath(`/forms/${formId}/edit`);
  return { success: "Form updated." };
}

export async function setFormStatusAction(formData: FormData): Promise<{ error?: string } | void> {
  const formId = String(formData.get("formId"));
  const { actor, form, error } = await requireFormEditor(formId);
  if (!form) return { error: error ?? "Form not found." };

  const nextStatus = String(formData.get("nextStatus")) as "ACTIVE" | "ARCHIVED";
  await prisma.form.update({ where: { id: formId }, data: { status: nextStatus } });

  await logAudit({
    actorUserId: actor.id,
    actionType: "FORM_UPDATED",
    targetEntityType: "Form",
    targetEntityId: formId,
    formId,
    metadata: { status: nextStatus },
  });

  revalidatePath("/forms");
  revalidatePath(`/forms/${formId}/edit`);
}

export async function deleteFormAction(formData: FormData): Promise<{ error?: string } | void> {
  const formId = String(formData.get("formId"));
  const { actor, form, error } = await requireFormEditor(formId);
  if (!form) return { error: error ?? "Form not found." };

  try {
    await prisma.form.delete({ where: { id: formId } });
  } catch (error) {
    // P2003 = foreign key constraint failed. FormAnswer.fieldId is Restrict
    // (no cascade) — once a submission has answered any question on this
    // form, the form's fields (and therefore the form itself) can't be
    // hard-deleted. Archiving is the only way to retire a form with
    // responses already collected.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        error: `"${form.title}" can't be deleted — it already has submitted responses. Archive it instead to stop collecting responses.`,
      };
    }
    throw error;
  }

  await logAudit({
    actorUserId: actor.id,
    actionType: "FORM_DELETED",
    targetEntityType: "Form",
    targetEntityId: formId,
    metadata: { title: form.title },
  });

  revalidatePath("/forms");
}

function parseOptionsText(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function addFieldAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const formId = String(formData.get("formId") ?? "");
  const { actor, form, error } = await requireFormEditor(formId);
  if (error || !form) return { error: error ?? "Form not found." };

  const parsed = formFieldSchema.safeParse({
    label: formData.get("label"),
    helpText: formData.get("helpText"),
    type: formData.get("type"),
    required: formData.get("required"),
    optionsSource: formData.get("optionsSource"),
    optionsText: formData.get("optionsText"),
    maxFiles: formData.get("maxFiles"),
    maxFileSizeMb: formData.get("maxFileSizeMb"),
    isLocationField: formData.get("isLocationField"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  if (data.isLocationField && !(data.type === "DROPDOWN" && data.optionsSource === "LOCATIONS")) {
    return { error: "Only a Dropdown field bound to Locations can be marked as the location field." };
  }

  const count = await prisma.formField.count({ where: { formId } });

  await prisma.$transaction(async (tx) => {
    if (data.isLocationField) {
      await tx.formField.updateMany({ where: { formId }, data: { isLocationField: false } });
    }
    const field = await tx.formField.create({
      data: {
        formId,
        label: data.label,
        helpText: data.helpText,
        type: data.type,
        required: data.required,
        optionsSource: data.optionsSource,
        maxFiles: data.type === "FILE_UPLOAD" ? (data.maxFiles ?? 1) : null,
        maxFileSizeMb: data.type === "FILE_UPLOAD" ? (data.maxFileSizeMb ?? 10) : null,
        isLocationField: data.isLocationField,
        sortOrder: count,
      },
    });

    if (data.optionsSource === "CUSTOM" && ["DROPDOWN", "MULTIPLE_CHOICE", "CHECKBOXES"].includes(data.type)) {
      const options = parseOptionsText(data.optionsText);
      if (options.length > 0) {
        await tx.formFieldOption.createMany({
          data: options.map((label, i) => ({ fieldId: field.id, label, sortOrder: i })),
        });
      }
    }
  });

  await logAudit({
    actorUserId: actor.id,
    actionType: "FORM_UPDATED",
    targetEntityType: "Form",
    targetEntityId: formId,
    formId,
    metadata: { action: "field_added", label: data.label },
  });

  revalidatePath(`/forms/${formId}/edit`);
  return { success: "Question added." };
}

export async function updateFieldAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const formId = String(formData.get("formId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const { form, error } = await requireFormEditor(formId);
  if (error || !form) return { error: error ?? "Form not found." };

  const parsed = formFieldSchema.safeParse({
    label: formData.get("label"),
    helpText: formData.get("helpText"),
    type: formData.get("type"),
    required: formData.get("required"),
    optionsSource: formData.get("optionsSource"),
    optionsText: formData.get("optionsText"),
    maxFiles: formData.get("maxFiles"),
    maxFileSizeMb: formData.get("maxFileSizeMb"),
    isLocationField: formData.get("isLocationField"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  if (data.isLocationField && !(data.type === "DROPDOWN" && data.optionsSource === "LOCATIONS")) {
    return { error: "Only a Dropdown field bound to Locations can be marked as the location field." };
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.isLocationField) {
      await tx.formField.updateMany({
        where: { formId, id: { not: fieldId } },
        data: { isLocationField: false },
      });
    }
    // Scoped by formId, not just id, so a form editor can't mutate a field
    // belonging to a different form by supplying an arbitrary fieldId.
    const { count } = await tx.formField.updateMany({
      where: { id: fieldId, formId },
      data: {
        label: data.label,
        helpText: data.helpText,
        type: data.type,
        required: data.required,
        optionsSource: data.optionsSource,
        maxFiles: data.type === "FILE_UPLOAD" ? (data.maxFiles ?? 1) : null,
        maxFileSizeMb: data.type === "FILE_UPLOAD" ? (data.maxFileSizeMb ?? 10) : null,
        isLocationField: data.isLocationField,
      },
    });
    if (count === 0) return false;

    if (data.optionsSource === "CUSTOM" && ["DROPDOWN", "MULTIPLE_CHOICE", "CHECKBOXES"].includes(data.type)) {
      await tx.formFieldOption.deleteMany({ where: { fieldId } });
      const options = parseOptionsText(data.optionsText);
      if (options.length > 0) {
        await tx.formFieldOption.createMany({
          data: options.map((label, i) => ({ fieldId, label, sortOrder: i })),
        });
      }
    } else {
      await tx.formFieldOption.deleteMany({ where: { fieldId } });
    }
    return true;
  });
  if (!updated) return { error: "Question not found on this form." };

  revalidatePath(`/forms/${formId}/edit`);
  return { success: "Question updated." };
}

export async function removeFieldAction(formData: FormData): Promise<{ error?: string } | void> {
  const formId = String(formData.get("formId"));
  const fieldId = String(formData.get("fieldId"));
  const { form, error } = await requireFormEditor(formId);
  if (!form) return { error: error ?? "Form not found." };

  try {
    // Scoped by formId, not just id — same cross-form IDOR guard as above.
    const { count } = await prisma.formField.deleteMany({ where: { id: fieldId, formId } });
    if (count === 0) return { error: "Question not found on this form." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        error: "This question already has submitted answers or files and can't be removed. Archive the form instead once you're done collecting responses.",
      };
    }
    throw error;
  }

  revalidatePath(`/forms/${formId}/edit`);
}

// Used as a raw <form action={...}> prop (native up/down buttons), which
// React types as returning void | Promise<void> only — unlike the
// ConfirmButton-based actions below, there's no UI path to display an error
// here, so this stays void; it's already scoped by formId via the findMany
// below, so there's no IDOR to fix, just no user-facing failure signal.
export async function moveFieldInFormAction(formData: FormData): Promise<void> {
  const formId = String(formData.get("formId"));
  const fieldId = String(formData.get("fieldId"));
  const direction = String(formData.get("direction")) as "up" | "down";
  const { form } = await requireFormEditor(formId);
  if (!form) return;

  const rows = await prisma.formField.findMany({ where: { formId }, orderBy: { sortOrder: "asc" } });
  const index = rows.findIndex((r) => r.id === fieldId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= rows.length) return;

  const a = rows[index];
  const b = rows[swapIndex];
  await prisma.$transaction([
    prisma.formField.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.formField.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidatePath(`/forms/${formId}/edit`);
}

export async function grantFormAccessAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const formId = String(formData.get("formId") ?? "");
  const actor = await requireActor();
  const loaded = await loadFormWithCreator(formId);
  if (!loaded) return { error: "Form not found." };
  const { form } = loaded;
  if (!canGrantFormAccess(actor, form)) return { error: "You don't have permission to share this form." };

  const parsed = grantFormAccessSchema.safeParse({ username: formData.get("username") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid username." };

  const target = await prisma.user.findUnique({
    where: { usernameLower: parsed.data.username.toLowerCase() },
  });
  if (!target || target.deletedAt || target.status !== "ACTIVE") {
    return { error: "No active user found with that username." };
  }
  if (target.role === "CONSULTANT") {
    return { error: "Consultants can't be granted access to form data." };
  }

  await prisma.formAccessGrant.upsert({
    where: { formId_grantedToUserId: { formId, grantedToUserId: target.id } },
    create: { formId, grantedToUserId: target.id, grantedByUserId: actor.id },
    update: {},
  });

  revalidatePath(`/forms/${formId}/edit`);
  return { success: `${target.firstName} ${target.lastName} can now see this form's data.` };
}

export async function revokeFormAccessAction(formData: FormData): Promise<{ error?: string } | void> {
  const formId = String(formData.get("formId"));
  const grantId = String(formData.get("grantId"));
  const actor = await requireActor();
  const loaded = await loadFormWithCreator(formId);
  if (!loaded) return { error: "Form not found." };
  if (!canGrantFormAccess(actor, loaded.form)) return { error: "You don't have permission to manage access to this form." };

  // Scoped by formId, not just id — an actor with grant rights on one form
  // can't revoke a grant belonging to a different form by supplying an
  // arbitrary grantId.
  const { count } = await prisma.formAccessGrant.deleteMany({ where: { id: grantId, formId } });
  if (count === 0) return { error: "Access grant not found on this form." };
  revalidatePath(`/forms/${formId}/edit`);
}

/** Re-exported for the submissions page, which needs the same combined check per-row. */
export { canViewForm, canViewFormsByCreator };
