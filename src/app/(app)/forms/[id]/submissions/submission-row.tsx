"use client";

import { useState } from "react";

type Answer = { fieldLabel: string; fieldType: string; valueText: string | null; valueJson: unknown };
type FileEntry = { id: string; fileName: string; fieldLabel: string };

export function SubmissionRow({
  submittedAt,
  locationName,
  answers,
  files,
}: {
  submittedAt: string;
  locationName: string | null;
  answers: Answer[];
  files: FileEntry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm text-[var(--color-ink)]">{submittedAt}</span>
        <span className="flex items-center gap-3 text-xs text-[var(--color-ink-soft)]">
          {locationName && <span>{locationName}</span>}
          <span>{open ? "Hide" : "View"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <dl className="space-y-2">
            {answers.map((a, i) => (
              <div key={i}>
                <dt className="text-xs font-medium text-[var(--color-ink-soft)]">{a.fieldLabel}</dt>
                <dd className="text-sm text-[var(--color-ink)]">
                  {a.valueJson
                    ? (a.valueJson as string[]).join(", ")
                    : a.valueText || <span className="text-[var(--color-ink-faint)]">—</span>}
                </dd>
              </div>
            ))}
          </dl>
          {files.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-[var(--color-ink-soft)]">Files</p>
              <ul className="mt-1 space-y-1">
                {files.map((f) => (
                  <li key={f.id}>
                    <a href={`/api/forms/files/${f.id}`} className="text-sm text-[var(--color-accent)] hover:underline">
                      {f.fieldLabel}: {f.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
