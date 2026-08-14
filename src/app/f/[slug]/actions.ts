"use server";

import { headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { checkFormSubmissionRateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

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
    include: { fields: true },
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
      for (const f of parsed) {
        if (!f.pathname || !f.fileName) continue;
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
      if (values.length > 0) answersToCreate.push({ fieldId: field.id, valueJson: values });
      continue;
    }

    const raw = formData.get(`answer-${field.id}`);
    const value = raw ? String(raw).trim() : "";
    if (field.required && !value) {
      return { error: `"${field.label}" is required.` };
    }
    if (value) {
      answersToCreate.push({ fieldId: field.id, valueText: value });
      if (field.isLocationField) resolvedLocationId = value;
    }
  }

  if (resolvedLocationId) {
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
