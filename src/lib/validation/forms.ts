import { z } from "zod";
import { nameSchema, optionalTrimmedString, usernameSchema } from "@/lib/validation/user";

export const formSchema = z.object({
  title: nameSchema,
  description: optionalTrimmedString(z.string().trim().max(2000)),
});

export const formFieldTypeSchema = z.enum([
  "SHORT_TEXT",
  "PARAGRAPH",
  "DATE",
  "DROPDOWN",
  "MULTIPLE_CHOICE",
  "CHECKBOXES",
  "FILE_UPLOAD",
]);

export const formFieldOptionsSourceSchema = z.enum(["CUSTOM", "LOCATIONS", "TECHNOLOGIES"]);

// FormData.get() returns null (not undefined) for a field that isn't in the
// DOM at submit time (e.g. maxFiles/maxFileSizeMb, only rendered for
// FILE_UPLOAD fields) — preprocess null/"" to undefined first, same fix as
// optionsSource above and optionalTrimmedString in validation/user.ts.
const optionalPositiveInt = (max: number) =>
  z.preprocess(
    (val) => (val == null || val === "" ? undefined : val),
    z
      .string()
      .trim()
      .optional()
      .transform((val) => (val ? Number(val) : undefined))
      .refine((val) => val === undefined || (Number.isInteger(val) && val > 0 && val <= max), {
        message: `Must be a whole number between 1 and ${max}.`,
      })
  );

export const formFieldSchema = z.object({
  label: nameSchema,
  helpText: optionalTrimmedString(z.string().trim().max(500)),
  type: formFieldTypeSchema,
  required: z.preprocess((val) => val === "on" || val === "true" || val === true, z.boolean()),
  // FieldFormFields only renders the optionsSource <select> for choice-type
  // fields, so formData.get("optionsSource") is null (not undefined) for
  // every other type — preprocess null to undefined first so .default()
  // actually applies, same fix optionalTrimmedString documents for blanks.
  optionsSource: z.preprocess((val) => (val == null || val === "" ? undefined : val), formFieldOptionsSourceSchema.default("CUSTOM")),
  // Newline-separated custom choices — only read when optionsSource === CUSTOM
  // and type is DROPDOWN/MULTIPLE_CHOICE/CHECKBOXES.
  optionsText: optionalTrimmedString(z.string().trim().max(4000)),
  maxFiles: optionalPositiveInt(5),
  maxFileSizeMb: optionalPositiveInt(10),
  isLocationField: z.preprocess((val) => val === "on" || val === "true" || val === true, z.boolean()),
});

export const grantFormAccessSchema = z.object({
  username: usernameSchema,
});
