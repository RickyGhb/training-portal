import "server-only";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewForm, type FormCreatorSubject } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import type { FormFieldOptionsSource, FormFieldType, Prisma } from "@/generated/prisma/client";

export const RESPONSES_PAGE_SIZE = 50;

/** Roles that can see an individual submission purely because its resolved
 *  location matches their own (Mechanism B — see canViewSubmission in rbac.ts). */
const LOCATION_SCOPED_ROLES = new Set(["LOCATION_MANAGER", "LOCATION_ADMIN", "COORDINATOR"]);

export type ResponseField = {
  id: string;
  label: string;
  type: FormFieldType;
  optionsSource: FormFieldOptionsSource;
  isLocationField: boolean;
};

/** One cell of the responses grid. `files` is only ever populated for FILE_UPLOAD fields. */
export type ResponseCell = {
  text: string;
  files: { id: string; fileName: string }[];
};

export type ResponseRow = {
  id: string;
  submittedAt: Date;
  locationName: string | null;
  /** Keyed by fieldId — a field the respondent skipped has no entry at all,
   *  which is why the grid must look cells up by id rather than zipping arrays. */
  cells: Record<string, ResponseCell>;
};

export type ResponseFilters = {
  q?: string;
  from?: string;
  to?: string;
};

export type SortDirection = "asc" | "desc";

/**
 * Loads a form for someone trying to view its responses, and decides how much
 * of it they may see. "not-found" and "forbidden" are distinguished so the
 * caller can 404 an unknown id without telling an unauthorized viewer that a
 * form they can't see exists.
 *
 * status "ok" with hasFullAccess false means the viewer is location-scoped
 * (Mechanism B): they may see only the submissions whose resolved locationId
 * matches their own, never the whole response set.
 */
export async function loadFormForViewer(actor: SessionUser, formId: string) {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      createdBy: { select: { role: true, locationId: true, offshoreOffice: true } },
      accessGrants: { select: { grantedToUserId: true } },
      fields: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, type: true, optionsSource: true, isLocationField: true },
      },
    },
  });
  if (!form) return { status: "not-found" as const };

  const creator: FormCreatorSubject | null = form.createdBy
    ? {
        role: form.createdBy.role,
        locationId: form.createdBy.locationId,
        offshoreOffice: form.createdBy.offshoreOffice,
      }
    : null;
  const hasGrant = form.accessGrants.some((g) => g.grantedToUserId === actor.id);
  const hasFullAccess = canViewForm(actor, form, creator, hasGrant);
  const isLocationScoped = LOCATION_SCOPED_ROLES.has(actor.role) && actor.locationId !== null;

  if (!hasFullAccess && !isLocationScoped) return { status: "forbidden" as const };

  return {
    status: "ok" as const,
    form,
    fields: form.fields as ResponseField[],
    hasFullAccess,
    /** True when the form routes submissions to a location — drives the Location column. */
    hasLocationField: form.fields.some((f) => f.isLocationField),
  };
}

/**
 * The submission where-clause: the viewer's scope AND the user's filters,
 * never merged into one flat object. Same discipline as consultantScopeFilter
 * in reports.ts — a filter can only ever narrow within scope, never widen it.
 */
export function buildSubmissionWhere(
  formId: string,
  actor: { locationId: string | null },
  hasFullAccess: boolean,
  filters: ResponseFilters,
  /** Submission ids whose CHECKBOXES answers matched the search — see findCheckboxAnswerMatches. */
  checkboxMatchIds: string[] = []
): Prisma.FormSubmissionWhereInput {
  const scope: Prisma.FormSubmissionWhereInput = hasFullAccess
    ? { formId }
    : { formId, locationId: actor.locationId };

  const and: Prisma.FormSubmissionWhereInput[] = [];

  const q = filters.q?.trim();
  if (q) {
    // valueText covers every single-value answer type. CHECKBOXES answers live
    // in valueJson and can't be substring-matched by a Prisma JSON filter, so
    // their matching submission ids are resolved separately (by raw SQL, in
    // findCheckboxAnswerMatches) and OR'd in here. Both halves sit inside the
    // same AND as the scope, so a match can never escape the viewer's scope.
    const textMatch: Prisma.FormSubmissionWhereInput = {
      answers: { some: { valueText: { contains: q, mode: "insensitive" } } },
    };
    and.push(
      checkboxMatchIds.length
        ? { OR: [textMatch, { id: { in: checkboxMatchIds } }] }
        : textMatch
    );
  }

  const submittedAt: Prisma.DateTimeFilter = {};
  const from = parseDateInput(filters.from);
  const to = parseDateInput(filters.to);
  if (from) submittedAt.gte = from;
  if (to) {
    // <input type="date"> gives midnight; include the whole selected day.
    to.setHours(23, 59, 59, 999);
    submittedAt.lte = to;
  }
  if (from || to) and.push({ submittedAt });

  return and.length ? { AND: [scope, ...and] } : scope;
}

function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Renders one answer to the single string shown in a grid cell and written to
 * an export, so the two can never disagree. Pure — no imports, unit tested.
 */
export function formatAnswerValue(answer: { valueText: string | null; valueJson: unknown } | undefined): string {
  if (!answer) return "";
  if (Array.isArray(answer.valueJson)) {
    return answer.valueJson.filter((v) => v !== null && v !== undefined).join(", ");
  }
  return answer.valueText ?? "";
}

const SUBMISSION_INCLUDE = {
  location: { select: { name: true } },
  answers: { select: { fieldId: true, valueText: true, valueJson: true } },
  files: { select: { id: true, fieldId: true, fileName: true } },
} satisfies Prisma.FormSubmissionInclude;

/**
 * Fetches one page of responses as grid rows.
 *
 * Sorting by a question column can't be expressed as a Prisma `orderBy` (the
 * value lives in a related row), so that path resolves the page's ids from a
 * deliberately narrow query first and only then pulls the full answer/file
 * include for the 50 rows actually being shown.
 */
export async function getFormResponseRows(
  fields: ResponseField[],
  where: Prisma.FormSubmissionWhereInput,
  options: { sortFieldId: string | null; sortDir: SortDirection; page: number }
): Promise<{ rows: ResponseRow[]; total: number; totalPages: number }> {
  const { sortFieldId, sortDir, page } = options;
  const skip = (page - 1) * RESPONSES_PAGE_SIZE;

  const total = await prisma.formSubmission.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / RESPONSES_PAGE_SIZE));

  const sortField = sortFieldId ? fields.find((f) => f.id === sortFieldId) : undefined;

  let submissions: Prisma.FormSubmissionGetPayload<{ include: typeof SUBMISSION_INCLUDE }>[];

  if (!sortField) {
    submissions = await prisma.formSubmission.findMany({
      where,
      orderBy: { submittedAt: sortDir },
      skip,
      take: RESPONSES_PAGE_SIZE,
      include: SUBMISSION_INCLUDE,
    });
  } else {
    const candidates = await prisma.formSubmission.findMany({
      where,
      select: {
        id: true,
        submittedAt: true,
        answers: { where: { fieldId: sortField.id }, select: { valueText: true, valueJson: true } },
      },
    });

    // A dropdown bound to the live Locations list stores the Location's id, so
    // sort by the resolved name rather than by an opaque cuid.
    const sortNames =
      sortField.optionsSource === "LOCATIONS"
        ? await resolveLocationNames(candidates.flatMap((c) => c.answers.map((a) => a.valueText)))
        : {};

    const keyed = candidates.map((c) => {
      const raw = formatAnswerValue(c.answers[0]);
      return { id: c.id, key: sortNames[raw] ?? raw };
    });

    keyed.sort((a, b) => {
      // Unanswered questions always sink to the bottom, whichever direction.
      if (!a.key && !b.key) return 0;
      if (!a.key) return 1;
      if (!b.key) return -1;
      const cmp = a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });

    const pageIds = keyed.slice(skip, skip + RESPONSES_PAGE_SIZE).map((k) => k.id);
    if (pageIds.length === 0) return { rows: [], total, totalPages };

    const unordered = await prisma.formSubmission.findMany({
      where: { id: { in: pageIds } },
      include: SUBMISSION_INCLUDE,
    });
    const byId = new Map(unordered.map((s) => [s.id, s]));
    submissions = pageIds.map((id) => byId.get(id)!).filter(Boolean);
  }

  const locationFieldIds = new Set(fields.filter((f) => f.optionsSource === "LOCATIONS").map((f) => f.id));
  const locationNamesById = await resolveLocationNames(
    submissions.flatMap((s) => s.answers.filter((a) => locationFieldIds.has(a.fieldId)).map((a) => a.valueText))
  );

  const rows: ResponseRow[] = submissions.map((s) => {
    const cells: Record<string, ResponseCell> = {};

    for (const answer of s.answers) {
      const raw = formatAnswerValue(answer);
      cells[answer.fieldId] = {
        text: locationFieldIds.has(answer.fieldId) ? (locationNamesById[raw] ?? raw) : raw,
        files: [],
      };
    }
    for (const file of s.files) {
      const cell = (cells[file.fieldId] ??= { text: "", files: [] });
      cell.files.push({ id: file.id, fileName: file.fileName });
    }

    return {
      id: s.id,
      submittedAt: s.submittedAt,
      locationName: s.location?.name ?? null,
      cells,
    };
  });

  return { rows, total, totalPages };
}

/**
 * Finds the submissions on this form whose CHECKBOXES answers contain `q` in
 * any selected option.
 *
 * Needs raw SQL: the values live in a JSONB array, and Prisma's JSON filters
 * only offer exact element matching (`array_contains`), not the substring
 * match the rest of the search uses. Restricted to CHECKBOXES fields and
 * guarded by jsonb_typeof so jsonb_array_elements_text can never be handed a
 * non-array value. Fully parameterized — `q` is never interpolated into SQL.
 */
export async function findCheckboxAnswerMatches(formId: string, q: string): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  // Escape LIKE metacharacters so a literal % or _ in the search box doesn't
  // silently turn into a wildcard.
  const pattern = `%${term.replace(/([\\%_])/g, "\\$1")}%`;

  const rows = await prisma.$queryRaw<{ submissionId: string }[]>(PrismaNamespace.sql`
    SELECT DISTINCT a."submissionId"
    FROM "FormAnswer" a
    JOIN "FormField" f ON f."id" = a."fieldId"
    JOIN "FormSubmission" s ON s."id" = a."submissionId"
    WHERE s."formId" = ${formId}
      AND f."type" = 'CHECKBOXES'
      AND jsonb_typeof(a."valueJson") = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(a."valueJson") AS elem
        WHERE elem ILIKE ${pattern} ESCAPE '\\'
      )
  `);
  return rows.map((r) => r.submissionId);
}

async function resolveLocationNames(rawIds: (string | null)[]): Promise<Record<string, string>> {
  const ids = [...new Set(rawIds.filter((v): v is string => Boolean(v)))];
  if (ids.length === 0) return {};
  const locations = await prisma.location.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return Object.fromEntries(locations.map((l) => [l.id, l.name]));
}
