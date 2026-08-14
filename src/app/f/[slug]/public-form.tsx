"use client";

import { useActionState, useState } from "react";
import { upload } from "@vercel/blob/client";
import { submitFormResponseAction, type SubmitFormState } from "./actions";

type FieldOption = { value: string; label: string };
type Field = {
  id: string;
  label: string;
  helpText: string | null;
  type: string;
  required: boolean;
  maxFiles: number | null;
  maxFileSizeMb: number | null;
  options: FieldOption[];
};

type UploadedFile = { pathname: string; fileName: string; sizeBytes: number; mimeType: string };

const initialState: SubmitFormState = {};

export function PublicForm({ slug, fields }: { slug: string; fields: Field[] }) {
  const [state, formAction, pending] = useActionState(submitFormResponseAction, initialState);
  const [files, setFiles] = useState<Record<string, UploadedFile[]>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  if (state.success) {
    return (
      <div className="card text-center">
        <p className="text-base font-medium text-[var(--color-ink)]">Thanks — your response was submitted.</p>
      </div>
    );
  }

  async function handleFileChange(field: Field, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const maxFiles = field.maxFiles ?? 1;
    const maxSizeBytes = (field.maxFileSizeMb ?? 10) * 1024 * 1024;
    const selected = Array.from(fileList).slice(0, maxFiles);

    const oversized = selected.find((f) => f.size > maxSizeBytes);
    if (oversized) {
      setUploadErrors((prev) => ({ ...prev, [field.id]: `Each file must be under ${field.maxFileSizeMb ?? 10}MB.` }));
      return;
    }

    setUploadErrors((prev) => ({ ...prev, [field.id]: "" }));
    setUploading((prev) => ({ ...prev, [field.id]: true }));

    try {
      const uploaded: UploadedFile[] = [];
      for (const file of selected) {
        const pathname = `forms/${slug}/${field.id}-${crypto.randomUUID()}-${file.name}`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: `/api/forms/${slug}/upload-token`,
        });
        uploaded.push({ pathname: blob.pathname, fileName: file.name, sizeBytes: file.size, mimeType: file.type });
      }
      setFiles((prev) => ({ ...prev, [field.id]: uploaded }));
    } catch {
      setUploadErrors((prev) => ({ ...prev, [field.id]: "Upload failed. Please try again." }));
    } finally {
      setUploading((prev) => ({ ...prev, [field.id]: false }));
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {/* Honeypot — left blank by real users, hidden from view; a filled value silently drops the submission. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Leave blank</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {fields.map((field) => (
        <div key={field.id} className="card">
          <label htmlFor={`field-${field.id}`} className="mb-1 block text-sm font-medium text-[var(--color-ink)]">
            {field.label}
            {field.required && <span className="ml-1 text-[var(--color-danger)]">*</span>}
          </label>
          {field.helpText && <p className="mb-2 text-xs text-[var(--color-ink-soft)]">{field.helpText}</p>}

          {field.type === "SHORT_TEXT" && (
            <input id={`field-${field.id}`} name={`answer-${field.id}`} required={field.required} className="w-full field" />
          )}
          {field.type === "PARAGRAPH" && (
            <textarea
              id={`field-${field.id}`}
              name={`answer-${field.id}`}
              required={field.required}
              rows={4}
              className="w-full field"
            />
          )}
          {field.type === "DATE" && (
            <input
              id={`field-${field.id}`}
              name={`answer-${field.id}`}
              type="date"
              required={field.required}
              className="w-full field"
            />
          )}
          {field.type === "DROPDOWN" && (
            <select id={`field-${field.id}`} name={`answer-${field.id}`} required={field.required} className="w-full field" defaultValue="">
              <option value="" disabled>
                Select...
              </option>
              {field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {field.type === "MULTIPLE_CHOICE" && (
            <div className="space-y-1">
              {field.options.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input type="radio" name={`answer-${field.id}`} value={o.value} required={field.required} />
                  {o.label}
                </label>
              ))}
            </div>
          )}
          {field.type === "CHECKBOXES" && (
            <div className="space-y-1">
              {field.options.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input type="checkbox" name={`answer-${field.id}`} value={o.value} />
                  {o.label}
                </label>
              ))}
            </div>
          )}
          {field.type === "FILE_UPLOAD" && (
            <div>
              <input
                id={`field-${field.id}`}
                type="file"
                multiple={(field.maxFiles ?? 1) > 1}
                accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(field, e.target.files)}
                className="w-full text-sm"
              />
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                Up to {field.maxFiles ?? 1} file{(field.maxFiles ?? 1) > 1 ? "s" : ""}, {field.maxFileSizeMb ?? 10}MB each.
              </p>
              {uploading[field.id] && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Uploading…</p>}
              {uploadErrors[field.id] && <p className="mt-1 text-xs text-[var(--color-danger)]">{uploadErrors[field.id]}</p>}
              {files[field.id] && files[field.id].length > 0 && (
                <ul className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  {files[field.id].map((f) => (
                    <li key={f.pathname}>✓ {f.fileName}</li>
                  ))}
                </ul>
              )}
              <input type="hidden" name={`files-${field.id}`} value={JSON.stringify(files[field.id] ?? [])} />
            </div>
          )}
        </div>
      ))}

      {state.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
