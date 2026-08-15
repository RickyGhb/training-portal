"use server";

import { headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { checkFormSubmissionRateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { TECHNOLOGY_OPTIONS } from "@/lib/technologyOptions";
import {
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_MAX_FILES,
  MAX_ANSWER_TEXT_LENGTH,
  MAX_CHECKBOX_SELECTIONS,
  MAX_UPLOAD_FILENAME_LENGTH,
  isAllowedUploadPathname,
} from "@/lib/validation/forms";

export type SubmitFormState = { error?: string; success?: boolean };

type UploadedFileMeta = { pathname: string; fileName: string; sizeBytes: number; mimeType: string };

/**
 * Handles a public, unauthenticated form response. No CSRF token — that
 * scheme is keyed off a session cookie an anonymous visitor never has (see
 * CLAUDE.md's Forms notes); Server Actions get Next's built-in CSRF
 * protection automatically regardless of that. Abuse is mitigated instead
 * by rate limiting + a honeypot field.
 */
export async function submitFormResponseAction(_prevState: SubmitFormState, formData: FormData): Promise<SubmitFormState> {
  const slug = String(formData.get("slug") ?? "");

  // Honeypot: real users never see/fill this field. A filled value looks
  // like a successful submission to whatever bot filled it, but nothing is
  // written — deliberately not revealing that it was detected.
  if (String(formData.get("website") ?? "").trim()) {
    return { success: true };
  }

  const form = await prisma.form.findUnique({
    where: { slug },
    include: { fields: { include: { options: true } } },
  });
  if (!form || form.status !== "ACTIVE") {
    return { error: "This form is no longer accepting responses." };
  }

  const headerList = await headers();
  const ipAddress = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const withinLimit = await checkFormSubmissionRateLimit(ipAddress, slug);
  if (!withinLimit) {
    return { error: "Too many submissions. Please wait a few minutes and try again." };
  }

  // Only fetched when a field actually needs it, so most submissions don't
  // pay for an extra query.
  const needsLocations = form.fields.some((f) => f.optionsSource === "LOCATIONS");
  const activeLocations = needsLocations
    ? await prisma.location.findMany({ where: { status: "ACTIVE" }, select: { id: true } })
    : [];
  const activeLocationIds = new Set(activeLocations.map((l) => l.id));

  type FormFieldWithOptions = (typeof form)["fields"][number];

  /** The set of values the client's <select>/checkbox UI could actually have offered for this field — mirrors src/app/f/[slug]/page.tsx's option-building logic. */
  function validOptionValues(field: FormFieldWithOptions): Set<string> | null {
    if (field.optionsSource === "LOCATIONS") return activeLocationIds;
    if (field.optionsSource === "TECHNOLOGIES") return new Set(TECHNOLOGY_OPTIONS.map((t) => t.value));
    return new Set(field.options.map((o) => o.label));
  }

  const answersToCreate: { fieldId: string; valueText?: string; valueJson?: Prisma.InputJsonValue }[] = [];
  const filesToCreate: {
    fieldId: string;
    fileName: string;
    storagePathname: string;
    fileSizeBytes: number;
    mimeType: string;
  }[] = [];
  let resolvedLocationId: string | null = null;

  for (const field of form.fields) {
    if (field.type === "FILE_UPLOAD") {
      const raw = formData.get(`files-${field.id}`);
      let parsed: UploadedFileMeta[] = [];
      try {
        parsed = raw ? JSON.parse(String(raw)) : [];
      } catch {
        parsed = [];
      }
      if (field.required && parsed.length === 0) {
        return { error: `"${field.label}" is required.` };
      }
      const maxFiles = field.maxFiles ?? DEFAULT_MAX_FILES;
      if (parsed.length > maxFiles) {
        return { error: `"${field.label}" allows at most ${maxFiles} file(s).` };
      }
      const maxSizeBytes = (field.maxFileSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB) * 1024 * 1024;
      for (const f of parsed) {
        if (!f.pathname || !f.fileName) continue;
        if (!isAllowedUploadPathname(f.pathname, slug, field.id)) {
          return { error: `"${field.label}" received an invalid file reference. Please re-upload.` };
        }
        if (f.fileName.length > MAX_UPLOAD_FILENAME_LENGTH) {
          return { error: `"${field.label}" has a file name that's too long.` };
        }
        if (typeof f.sizeBytes !== "number" || f.sizeBytes <= 0 || f.sizeBytes > maxSizeBytes) {
          return { error: `"${field.label}" has a file over the ${field.maxFileSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB}MB limit.` };
        }
        filesToCreate.push({
          fieldId: field.id,
          fileName: f.fileName,
          storagePathname: f.pathname,
          fileSizeBytes: f.sizeBytes,
          mimeType: f.mimeType,
        });
      }
      continue;
    }

    if (field.type === "CHECKBOXES") {
      const values = formData.getAll(`answer-${field.id}`).map(String).filter(Boolean);
      if (field.required && values.length === 0) {
        return { error: `"${field.label}" is required.` };
      }
      if (values.length > MAX_CHECKBOX_SELECTIONS) {
        return { error: `"${field.label}" has too many selections.` };
      }
      const valid = validOptionValues(field);
      if (valid && values.some((v) => !valid.has(v))) {
        return { error: `"${field.label}" received an invalid selection.` };
      }
      if (values.length > 0) answersToCreate.push({ fieldId: field.id, valueJson: values });
      continue;
    }

    const raw = formData.get(`answer-${field.id}`);
    const value = raw ? String(raw).trim() : "";
    if (field.required && !value) {
      return { error: `"${field.label}" is required.` };
    }
    if (value.length > MAX_ANSWER_TEXT_LENGTH) {
      return { error: `"${field.label}" is too long.` };
    }
    if (value && (field.type === "DROPDOWN" || field.type === "MULTIPLE_CHOICE")) {
      const valid = validOptionValues(field);
      if (valid && !valid.has(value)) {
        return { error: `"${field.label}" received an invalid selection.` };
      }
    }
    if (value) {
      answersToCreate.push({ fieldId: field.id, valueText: value });
      if (field.isLocationField) resolvedLocationId = value;
    }
  }

  if (resolvedLocationId && !activeLocationIds.has(resolvedLocationId)) {
    const location = await prisma.location.findFirst({
      where: { id: resolvedLocationId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!location) resolvedLocationId = null;
  }

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.formSubmission.create({
      data: { formId: form.id, locationId: resolvedLocationId, respondentIp: ipAddress },
    });
    if (answersToCreate.length > 0) {
      await tx.formAnswer.createMany({
        data: answersToCreate.map((a) => ({
          submissionId: created.id,
          fieldId: a.fieldId,
          valueText: a.valueText,
          valueJson: a.valueJson,
        })),
      });
    }
    if (filesToCreate.length > 0) {
      await tx.formFileUpload.createMany({
        data: filesToCreate.map((f) => ({ submissionId: created.id, ...f })),
      });
    }
    return created;
  });

  await logAudit({
    actorUserId: null,
    actionType: "FORM_SUBMITTED",
    targetEntityType: "Form",
    targetEntityId: form.id,
    formId: form.id,
    metadata: { submissionId: submission.id },
  });

  return { success: true };
}
