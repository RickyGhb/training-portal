import { NextResponse, type NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canViewSubmission, type FormCreatorSubject } from "@/lib/auth/rbac";

/**
 * Authenticated download for a Forms file upload. The file itself lives in a
 * private Vercel Blob store (no public URL exists for it at all — see
 * CLAUDE.md's Forms security note) — this route is the only way to read the
 * bytes, and it re-checks the exact same canViewSubmission logic the
 * submissions page uses before streaming anything, so access control is
 * enforced by the app on every request rather than relying on the blob URL
 * being hard to guess.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const file = await prisma.formFileUpload.findUnique({
    where: { id: fileId },
    include: {
      submission: {
        select: {
          locationId: true,
          form: {
            select: {
              id: true,
              createdByUserId: true,
              createdBy: { select: { role: true, locationId: true, offshoreOffice: true } },
              accessGrants: { select: { grantedToUserId: true } },
            },
          },
        },
      },
    },
  });
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const form = file.submission.form;
  const creator: FormCreatorSubject | null = form.createdBy
    ? { role: form.createdBy.role, locationId: form.createdBy.locationId, offshoreOffice: form.createdBy.offshoreOffice }
    : null;
  const hasGrant = form.accessGrants.some((g) => g.grantedToUserId === actor.id);
  const allowed = canViewSubmission(
    actor,
    { createdByUserId: form.createdByUserId },
    creator,
    hasGrant,
    { locationId: file.submission.locationId }
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const result = await get(file.storagePathname, { access: "private" });
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "File not found in storage." }, { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": file.mimeType || result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
