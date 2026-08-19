import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { csvEscape } from "@/lib/csvEscape";
import { logAudit } from "@/lib/audit";
import {
  buildSubmissionWhere,
  findCheckboxAnswerMatches,
  getFormResponseRows,
  loadFormForViewer,
  type ResponseRow,
  type SortDirection,
} from "@/lib/formResponses";

/** Hard ceiling on one download, so a runaway form can't try to buffer an
 *  unbounded workbook into memory. Far above any realistic response count. */
const MAX_EXPORT_ROWS = 10_000;

/**
 * Downloads a form's responses as CSV or XLSX. Authorization and scoping run
 * through the exact same loadFormForViewer/buildSubmissionWhere pair the
 * responses page uses, so a location-scoped viewer's download can never
 * contain rows their screen doesn't show.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;

  // Same reasoning as /api/reports/export: a plain GET Route Handler gets none
  // of Next.js's automatic Server Action CSRF protection. See src/lib/csrf.ts.
  if (!(await verifyCsrfToken(searchParams.get("csrfToken")))) {
    return NextResponse.json(
      { error: "Invalid or missing CSRF token. Reload the responses page and try again." },
      { status: 403 }
    );
  }

  const loaded = await loadFormForViewer(actor, id);
  if (loaded.status === "not-found") return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (loaded.status === "forbidden") {
    return NextResponse.json({ error: "You don't have permission to view this form." }, { status: 403 });
  }
  const { form, fields, hasFullAccess, hasLocationField } = loaded;

  const filters = {
    q: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  };
  const requestedSort = searchParams.get("sort");
  const sortFieldId = requestedSort && fields.some((f) => f.id === requestedSort) ? requestedSort : null;
  const sortDir: SortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const checkboxMatchIds = filters.q ? await findCheckboxAnswerMatches(form.id, filters.q) : [];
  const where = buildSubmissionWhere(form.id, actor, hasFullAccess, filters, checkboxMatchIds);

  // getFormResponseRows is paginated for the screen; page through it here so
  // the export covers the whole filtered set rather than just page 1.
  const rows: ResponseRow[] = [];
  let page = 1;
  for (;;) {
    const result = await getFormResponseRows(fields, where, { sortFieldId, sortDir, page });
    rows.push(...result.rows);
    if (page >= result.totalPages || rows.length >= MAX_EXPORT_ROWS) break;
    page += 1;
  }

  const headers = [
    "Submitted",
    ...(hasLocationField ? ["Location"] : []),
    ...fields.map((f) => f.label),
  ];
  const toValues = (row: ResponseRow): string[] => [
    row.submittedAt.toISOString(),
    ...(hasLocationField ? [row.locationName ?? ""] : []),
    ...fields.map((field) => {
      const cell = row.cells[field.id];
      if (!cell) return "";
      const fileNames = cell.files.map((f) => f.fileName).join("; ");
      return [cell.text, fileNames].filter(Boolean).join(" ");
    }),
  ];

  await logAudit({
    actorUserId: actor.id,
    actionType: "REPORT_EXPORTED",
    targetEntityType: "Form",
    targetEntityId: form.id,
    formId: form.id,
    metadata: { format, filters, rowCount: rows.length, formTitle: form.title },
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const fileSlug = form.slug.slice(0, 60);

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Responses");
    sheet.columns = headers.map((header) => ({ header, width: 24 }));
    for (const row of rows) sheet.addRow(toValues(row));
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileSlug}-responses-${timestamp}.xlsx"`,
      },
    });
  }

  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => toValues(row).map(csvEscape).join(",")),
  ].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileSlug}-responses-${timestamp}.csv"`,
    },
  });
}
