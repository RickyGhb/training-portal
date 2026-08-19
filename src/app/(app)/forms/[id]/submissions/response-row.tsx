"use client";

import { useState } from "react";
import { DeleteSubmissionButton } from "./delete-submission-button";
import type { ResponseField, ResponseRow } from "@/lib/formResponses";

/** Longer answers are clipped in the grid row; the full text lives in the expanded panel. */
const MAX_CELL_CHARS = 80;

/**
 * One response: the grid row itself, plus an expandable panel underneath
 * holding every answer in full. The grid stays scannable, and long paragraph
 * answers are still readable without leaving the page.
 */
export function ResponseRowGroup({
  formId,
  fields,
  row,
  submittedAtLabel,
  hasLocationField,
  canDelete,
  columnCount,
}: {
  formId: string;
  fields: ResponseField[];
  row: ResponseRow;
  /** Preformatted on the server — formatting a Date in this client component
   *  would risk a server/browser locale-and-timezone hydration mismatch. */
  submittedAtLabel: string;
  hasLocationField: boolean;
  canDelete: boolean;
  columnCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="cursor-pointer hover:bg-[var(--color-paper)]"
      >
        <td className="grid-sticky text-[var(--color-ink-soft)]">
          <span aria-hidden="true" className="mr-1.5 inline-block text-[var(--color-ink-faint)]">
            {open ? "▾" : "▸"}
          </span>
          {submittedAtLabel}
        </td>
        {hasLocationField && (
          <td className="text-[var(--color-ink-soft)]">{row.locationName ?? <Empty />}</td>
        )}
        {fields.map((field) => (
          <td key={field.id} className="max-w-xs whitespace-normal text-[var(--color-ink)]">
            <Cell cell={row.cells[field.id]} />
          </td>
        ))}
        {canDelete && (
          // Stop propagation so opening the confirm modal doesn't also toggle the row.
          <td onClick={(e) => e.stopPropagation()}>
            <DeleteSubmissionButton formId={formId} submissionId={row.id} />
          </td>
        )}
      </tr>
      {open && (
        <tr>
          <td colSpan={columnCount} className="whitespace-normal bg-[var(--color-paper)]">
            <dl className="space-y-3 px-2 py-1">
              {fields.map((field) => {
                const cell = row.cells[field.id];
                return (
                  <div key={field.id}>
                    <dt className="text-xs font-medium text-[var(--color-ink-soft)]">{field.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-ink)]">
                      {cell?.text ? cell.text : !cell?.files.length && <Empty />}
                      {cell?.files.length ? (
                        <ul className={cell.text ? "mt-1" : undefined}>
                          {cell.files.map((file) => (
                            <li key={file.id}>
                              <FileLink id={file.id} fileName={file.fileName} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

function Cell({ cell }: { cell: ResponseRow["cells"][string] | undefined }) {
  if (!cell) return <Empty />;

  const truncated = cell.text.length > MAX_CELL_CHARS;
  const shown = truncated ? `${cell.text.slice(0, MAX_CELL_CHARS)}…` : cell.text;

  return (
    <>
      {cell.text ? (
        <span title={truncated ? cell.text : undefined}>{shown}</span>
      ) : (
        cell.files.length === 0 && <Empty />
      )}
      {cell.files.length > 0 && (
        <ul className={cell.text ? "mt-1" : undefined}>
          {cell.files.map((file) => (
            <li key={file.id}>
              <FileLink id={file.id} fileName={file.fileName} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FileLink({ id, fileName }: { id: string; fileName: string }) {
  return (
    <a
      href={`/api/forms/files/${id}`}
      onClick={(e) => e.stopPropagation()}
      className="text-[var(--color-accent)] hover:underline"
      title={fileName}
    >
      {fileName}
    </a>
  );
}

function Empty() {
  return <span className="text-[var(--color-ink-faint)]">—</span>;
}
