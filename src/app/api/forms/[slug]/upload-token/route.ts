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

  const form = await prisma.form.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!form || form.status !== "ACTIVE") {
    return NextResponse.json({ error: "This form is not accepting responses." }, { status: 404 });
  }

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
        if (!pathname.startsWith(`forms/${slug}/`)) {
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
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
