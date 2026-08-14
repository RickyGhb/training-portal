"use client";

import { useState } from "react";

type FieldDefaults = {
  label?: string;
  helpText?: string;
  type?: string;
  required?: boolean;
  optionsSource?: string;
  optionsText?: string;
  maxFiles?: number | null;
  maxFileSizeMb?: number | null;
  isLocationField?: boolean;
};

const CHOICE_TYPES = new Set(["DROPDOWN", "MULTIPLE_CHOICE", "CHECKBOXES"]);

/** Shared field editor body, used inside both the "Add question" and "Edit question" modals. */
export function FieldFormFields({ defaults = {} }: { defaults?: FieldDefaults }) {
  const [type, setType] = useState(defaults.type ?? "SHORT_TEXT");
  const [optionsSource, setOptionsSource] = useState(defaults.optionsSource ?? "CUSTOM");

  const isChoiceType = CHOICE_TYPES.has(type);
  const isDropdown = type === "DROPDOWN";
  const canBeLocationField = isDropdown && optionsSource === "LOCATIONS";

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="field-label" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Question
        </label>
        <input id="field-label" name="label" required defaultValue={defaults.label} className="w-full field" />
      </div>
      <div>
        <label htmlFor="field-helpText" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Help text (optional)
        </label>
        <input id="field-helpText" name="helpText" defaultValue={defaults.helpText} className="w-full field" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="field-type" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
            Question type
          </label>
          <select
            id="field-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full field"
          >
            <option value="SHORT_TEXT">Short answer</option>
            <option value="PARAGRAPH">Paragraph</option>
            <option value="DATE">Date</option>
            <option value="DROPDOWN">Dropdown</option>
            <option value="MULTIPLE_CHOICE">Multiple choice</option>
            <option value="CHECKBOXES">Checkboxes</option>
            <option value="FILE_UPLOAD">File upload</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input type="checkbox" name="required" defaultChecked={defaults.required} />
            Required
          </label>
        </div>
      </div>

      {isChoiceType && (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-3">
          <div>
            <label htmlFor="field-optionsSource" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Choices come from
            </label>
            <select
              id="field-optionsSource"
              name="optionsSource"
              value={optionsSource}
              onChange={(e) => setOptionsSource(e.target.value)}
              className="w-full field"
            >
              <option value="CUSTOM">A custom list I write below</option>
              {isDropdown && <option value="LOCATIONS">The app&apos;s Locations list (live)</option>}
              <option value="TECHNOLOGIES">The app&apos;s Technology list (live)</option>
            </select>
          </div>

          {optionsSource === "CUSTOM" && (
            <div>
              <label htmlFor="field-optionsText" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
                Choices — one per line
              </label>
              <textarea
                id="field-optionsText"
                name="optionsText"
                rows={4}
                defaultValue={defaults.optionsText}
                className="w-full field"
              />
            </div>
          )}

          {canBeLocationField && (
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input type="checkbox" name="isLocationField" defaultChecked={defaults.isLocationField} />
              Use this field to route responses by location (only one field per form can be marked this way)
            </label>
          )}
        </div>
      )}
      {/* Keep isLocationField explicitly false in the payload when hidden, so the server never
          sees a stale "on" from a previous type selection. */}
      {!canBeLocationField && <input type="hidden" name="isLocationField" value="" />}

      {type === "FILE_UPLOAD" && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--color-border)] p-3">
          <div>
            <label htmlFor="field-maxFiles" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Max files (1–5)
            </label>
            <input
              id="field-maxFiles"
              name="maxFiles"
              type="number"
              min={1}
              max={5}
              defaultValue={defaults.maxFiles ?? 1}
              className="w-full field"
            />
          </div>
          <div>
            <label htmlFor="field-maxFileSizeMb" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
              Max size per file (MB, up to 10)
            </label>
            <input
              id="field-maxFileSizeMb"
              name="maxFileSizeMb"
              type="number"
              min={1}
              max={10}
              defaultValue={defaults.maxFileSizeMb ?? 10}
              className="w-full field"
            />
          </div>
        </div>
      )}
    </div>
  );
}
