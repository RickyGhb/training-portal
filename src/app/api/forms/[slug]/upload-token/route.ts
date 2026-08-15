import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkFormSubmissionRateLimit } from "@/lib/rateLimit";

/**
 * Mints a short-lived client upload token for the public form-fill page at
 * /f/[slug]. This route itself is public (covered by the /api/* carve-out
 * in src/proxy.ts) — the browser uploads file bytes directly to Vercel Blob
 * using the returned token, never routing them through this server, which
 * keeps large multi-file submissions from ever hitting a serverless
 * function body-size limit. Access to the *uploaded file afterward* is a
 * separate, authenticated concern — see /api/forms/files/[fileId].
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const form = await prisma.form.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      fields: { where: { type: "FILE_UPLOAD" }, select: { id: true, maxFileSizeMb: true } },
    },
  });
  if (!form || form.status !== "ACTIVE") {
    return NextResponse.json({ error: "This form is not accepting responses." }, { status: 404 });
  }
  const fileFieldsById = new Map(form.fields.map((f) => [f.id, f]));

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const withinLimit = await checkFormSubmissionRateLimit(ipAddress, slug);
  if (!withinLimit) {
    return NextResponse.json({ error: "Too many uploads. Please wait a few minutes and try again." }, { status: 429 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const prefix = `forms/${slug}/`;
        if (!pathname.startsWith(prefix)) {
          throw new Error("Invalid upload destination.");
        }
        // The client always names the blob `{fieldId}-{uuid}-{filename}`
        // (see public-form.tsx) — cuid()s never contain a dash, so the first
        // segment is the field id. Matching it against this form's actual
        // FILE_UPLOAD fields both rejects an unrelated/forged fieldId and
        // lets us enforce that specific field's configured size limit,
        // rather than a single hardcoded cap for every field on every form.
        const fieldId = pathname.slice(prefix.length).split("-")[0];
        const field = fieldId ? fileFieldsById.get(fieldId) : undefined;
        if (!field) {
          throw new Error("Invalid upload destination.");
        }
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/heic",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          maximumSizeInBytes: (field.maxFileSizeMb ?? 10) * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
