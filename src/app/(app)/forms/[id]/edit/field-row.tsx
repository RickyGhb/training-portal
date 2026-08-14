"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { updateFieldAction, removeFieldAction, moveFieldInFormAction } from "../../actions";
import { FieldFormFields } from "./field-form-fields";

const TYPE_LABELS: Record<string, string> = {
  SHORT_TEXT: "Short answer",
  PARAGRAPH: "Paragraph",
  DATE: "Date",
  DROPDOWN: "Dropdown",
  MULTIPLE_CHOICE: "Multiple choice",
  CHECKBOXES: "Checkboxes",
  FILE_UPLOAD: "File upload",
};

export function FieldRow({
  formId,
  field,
  isFirst,
  isLast,
}: {
  formId: string;
  field: {
    id: string;
    label: string;
    helpText: string | null;
    type: string;
    required: boolean;
    optionsSource: string;
    maxFiles: number | null;
    maxFileSizeMb: number | null;
    isLocationField: boolean;
    options: { label: string }[];
  };
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">
          {field.label}
          {field.required && <span className="ml-1 text-[var(--color-danger)]">*</span>}
        </p>
        <p className="text-xs text-[var(--color-ink-soft)]">
          {TYPE_LABELS[field.type] ?? field.type}
          {field.isLocationField && " · Location routing field"}
          {field.optionsSource === "LOCATIONS" && " · Locations (live)"}
          {field.optionsSource === "TECHNOLOGIES" && " · Technology (live)"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <form action={moveFieldInFormAction}>
          <input type="hidden" name="formId" value={formId} />
          <input type="hidden" name="fieldId" value={field.id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" disabled={isFirst} className="link-action disabled:opacity-30">
            ↑
          </button>
        </form>
        <form action={moveFieldInFormAction}>
          <input type="hidden" name="formId" value={formId} />
          <input type="hidden" name="fieldId" value={field.id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" disabled={isLast} className="link-action disabled:opacity-30">
            ↓
          </button>
        </form>
        <FormModalButton
          action={updateFieldAction}
          hiddenFields={{ formId, fieldId: field.id }}
          title="Edit question"
          submitLabel="Save"
          label="Edit"
        >
          <FieldFormFields
            defaults={{
              label: field.label,
              helpText: field.helpText ?? undefined,
              type: field.type,
              required: field.required,
              optionsSource: field.optionsSource,
              optionsText: field.options.map((o) => o.label).join("\n"),
              maxFiles: field.maxFiles,
              maxFileSizeMb: field.maxFileSizeMb,
              isLocationField: field.isLocationField,
            }}
          />
        </FormModalButton>
        <ConfirmButton
          action={removeFieldAction}
          hiddenFields={{ formId, fieldId: field.id }}
          confirmTitle="Remove question?"
          confirmMessage={`"${field.label}" will be removed from the form.`}
          confirmLabel="Remove"
          label="Remove"
          variant="danger"
        />
      </div>
    </div>
  );
}
