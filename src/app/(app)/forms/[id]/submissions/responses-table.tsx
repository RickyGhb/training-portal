import { ResponseRowGroup } from "./response-row";
import type { ResponseField, ResponseRow, SortDirection } from "@/lib/formResponses";

export function ResponsesTable({
  formId,
  fields,
  rows,
  hasLocationField,
  sortFieldId,
  sortDir,
  query,
  canDelete,
}: {
  formId: string;
  fields: ResponseField[];
  rows: ResponseRow[];
  hasLocationField: boolean;
  sortFieldId: string | null;
  sortDir: SortDirection;
  /** Current filter/search params, so a sort link doesn't drop them. */
  query: Record<string, string>;
  canDelete: boolean;
}) {
  // Changing the sort always returns to page 1 — page 3 of the old ordering
  // has no meaningful counterpart in the new one.
  const sortHref = (fieldId: string | null) => {
    const next = new URLSearchParams(query);
    next.delete("page");
    const isActive = sortFieldId === fieldId;
    if (fieldId) next.set("sort", fieldId);
    else next.delete("sort");
    next.set("dir", isActive && sortDir === "asc" ? "desc" : "asc");
    const qs = next.toString();
    return qs ? `?${qs}` : "?";
  };

  const indicator = (fieldId: string | null) => {
    if (sortFieldId !== fieldId) return null;
    return <span aria-hidden="true"> {sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const columnCount = 1 + (hasLocationField ? 1 : 0) + fields.length + (canDelete ? 1 : 0);

  return (
    <div className="grid-shell mt-4">
      <table className="grid-table">
        <thead>
          <tr>
            <th scope="col" className="grid-sticky">
              <a href={sortHref(null)} className="hover:text-[var(--color-ink)]">
                Submitted{indicator(null)}
              </a>
            </th>
            {hasLocationField && <th scope="col">Location</th>}
            {fields.map((field) => (
              <th key={field.id} scope="col">
                <a href={sortHref(field.id)} className="hover:text-[var(--color-ink)]" title={field.label}>
                  {field.label}
                  {indicator(field.id)}
                </a>
              </th>
            ))}
            {canDelete && <th scope="col"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ResponseRowGroup
              key={row.id}
              formId={formId}
              fields={fields}
              row={row}
              submittedAtLabel={row.submittedAt.toLocaleString()}
              hasLocationField={hasLocationField}
              canDelete={canDelete}
              columnCount={columnCount}
            />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                No responses match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
