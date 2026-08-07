import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/session";
import { canExportReports } from "@/lib/auth/rbac";
import { getConsultantReportRows, type ConsultantReportFilters } from "@/lib/reports";
import { logAudit, notifyCeos } from "@/lib/audit";

const EXPORT_COLUMNS = [
  { header: "First name", key: "firstName" },
  { header: "Last name", key: "lastName" },
  { header: "Username", key: "username" },
  { header: "Email", key: "email" },
  { header: "Phone", key: "phone" },
  { header: "Location", key: "locationName" },
  { header: "Coordinator", key: "coordinatorName" },
  { header: "Primary training path", key: "primaryTrainingPathName" },
  { header: "Extra courses", key: "extraCourseNames" },
  { header: "Status", key: "status" },
  { header: "Completed videos", key: "completedVideos" },
  { header: "Total videos", key: "totalVideos" },
  { header: "Completion %", key: "completionPercentage" },
  { header: "Last completed item", key: "lastCompletedItem" },
  { header: "Last activity date", key: "lastActivityDate" },
] as const;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toExportValue(row: Awaited<ReturnType<typeof getConsultantReportRows>>[number], key: string): string {
  switch (key) {
    case "extraCourseNames":
      return row.extraCourseNames.join("; ");
    case "lastActivityDate":
      return row.lastActivityDate ? row.lastActivityDate.toISOString().slice(0, 10) : "";
    default: {
      const value = (row as unknown as Record<string, unknown>)[key];
      return value === null || value === undefined ? "" : String(value);
    }
  }
}

export async function GET(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!canExportReports(actor.role)) {
    return NextResponse.json({ error: "You don't have permission to export reports." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const format = params.get("format") === "xlsx" ? "xlsx" : "csv";
  const filters: ConsultantReportFilters = {
    locationId: params.get("locationId") || undefined,
    coordinatorId: params.get("coordinatorId") || undefined,
    trainingPathId: params.get("trainingPathId") || undefined,
    status:
      params.get("status") && ["ACTIVE", "DEACTIVATED", "DELETED"].includes(params.get("status")!)
        ? (params.get("status") as "ACTIVE" | "DEACTIVATED" | "DELETED")
        : undefined,
  };

  const rows = await getConsultantReportRows(actor, filters);

  const auditEntry = await logAudit({
    actorUserId: actor.id,
    actionType: "REPORT_EXPORTED",
    targetEntityType: "Report",
    metadata: { format, filters, rowCount: rows.length },
  });

  if (actor.role === "MANAGER") {
    await notifyCeos({
      type: "REPORT_EXPORTED",
      title: "Manager exported a report",
      body: `${actor.firstName} ${actor.lastName} exported a ${format.toUpperCase()} report (${rows.length} consultant${rows.length === 1 ? "" : "s"}).`,
      sourceAuditLogId: auditEntry.id,
    });
  }

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Consultants");
    sheet.columns = EXPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 20 }));
    for (const row of rows) {
      sheet.addRow(
        Object.fromEntries(EXPORT_COLUMNS.map((c) => [c.key, toExportValue(row, c.key)]))
      );
    }
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="consultant-report-${timestamp}.xlsx"`,
      },
    });
  }

  const lines = [
    EXPORT_COLUMNS.map((c) => csvEscape(c.header)).join(","),
    ...rows.map((row) => EXPORT_COLUMNS.map((c) => csvEscape(toExportValue(row, c.key))).join(",")),
  ];
  const csv = lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="consultant-report-${timestamp}.csv"`,
    },
  });
}
