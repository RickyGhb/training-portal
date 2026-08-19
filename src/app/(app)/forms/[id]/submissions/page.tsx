import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isCeo } from "@/lib/auth/rbac";
import { getCsrfToken } from "@/lib/csrf";
import {
  buildSubmissionWhere,
  findCheckboxAnswerMatches,
  getFormResponseRows,
  loadFormForViewer,
  type SortDirection,
} from "@/lib/formResponses";
import { ResponsesTable } from "./responses-table";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function FormSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const sp = await searchParams;
  const rawPage = firstParam(sp.page);
  const page = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;
  const filters = { q: firstParam(sp.q), from: firstParam(sp.from), to: firstParam(sp.to) };
  const sortDir: SortDirection = firstParam(sp.dir) === "asc" ? "asc" : "desc";

  const loaded = await loadFormForViewer(actor, id);
  if (loaded.status === "not-found") notFound();
  if (loaded.status === "forbidden") redirect("/forms");
  const { form, fields, hasFullAccess, hasLocationField } = loaded;

  // Only sort by a column that actually belongs to this form.
  const requestedSort = firstParam(sp.sort);
  const sortFieldId = fields.some((f) => f.id === requestedSort) ? requestedSort : null;

  // Checkbox answers live in valueJson and need their own lookup before the
  // where-clause can be built — see findCheckboxAnswerMatches.
  const checkboxMatchIds = filters.q ? await findCheckboxAnswerMatches(form.id, filters.q) : [];
  const where = buildSubmissionWhere(form.id, actor, hasFullAccess, filters, checkboxMatchIds);
  const { rows, total, totalPages } = await getFormResponseRows(fields, where, { sortFieldId, sortDir, page });

  const csrfToken = await getCsrfToken();
  const canDelete = actor.id === form.createdByUserId || isCeo(actor.role);

  // Carried onto sort links, pagination links, and the export form so the
  // download always matches what's on screen.
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  if (sortFieldId) query.sort = sortFieldId;
  query.dir = sortDir;

  const pageHref = (target: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(target));
    return `?${next.toString()}`;
  };

  const hasFilters = Boolean(filters.q || filters.from || filters.to);

  return (
    <div>
      <Link href="/forms" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        ← Forms
      </Link>
      <h1 className="page-title mt-2">{form.title}</h1>
      <p className="page-subtitle">
        {total} response{total === 1 ? "" : "s"}
        {hasFilters && " matching your filters"}
        {!hasFullAccess && " (scoped to your location)"}
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          {sortFieldId && <input type="hidden" name="sort" value={sortFieldId} />}
          <input type="hidden" name="dir" value={sortDir} />
          <div>
            <label htmlFor="responses-q" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Search answers
            </label>
            <input id="responses-q" name="q" type="search" defaultValue={filters.q} className="w-56 field" />
          </div>
          <div>
            <label htmlFor="responses-from" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              From
            </label>
            <input id="responses-from" name="from" type="date" defaultValue={filters.from} className="field" />
          </div>
          <div>
            <label htmlFor="responses-to" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              To
            </label>
            <input id="responses-to" name="to" type="date" defaultValue={filters.to} className="field" />
          </div>
          <button type="submit" className="btn-primary">
            Apply
          </button>
          {hasFilters && (
            <Link href={`/forms/${form.id}/submissions`} className="btn-secondary">
              Clear
            </Link>
          )}
        </form>

        <form method="GET" action={`/api/forms/export/${form.id}`} className="flex items-end gap-2">
          {csrfToken && <input type="hidden" name="csrfToken" value={csrfToken} />}
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          {filters.from && <input type="hidden" name="from" value={filters.from} />}
          {filters.to && <input type="hidden" name="to" value={filters.to} />}
          <button type="submit" name="format" value="csv" className="btn-secondary">
            Download CSV
          </button>
          <button type="submit" name="format" value="xlsx" className="btn-secondary">
            Download Excel
          </button>
        </form>
      </div>

      {fields.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-ink-faint)]">
          This form has no questions yet, so there is nothing to show.
        </p>
      ) : (
        <ResponsesTable
          formId={form.id}
          fields={fields}
          rows={rows}
          hasLocationField={hasLocationField}
          sortFieldId={sortFieldId}
          sortDir={sortDir}
          query={query}
          canDelete={canDelete}
        />
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-ink-soft)]">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <a
              href={pageHref(page - 1)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1 hover:bg-[var(--color-paper)]"
            >
              ← Previous
            </a>
          )}
          {page < totalPages && (
            <a
              href={pageHref(page + 1)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1 hover:bg-[var(--color-paper)]"
            >
              Next →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
