import { z } from "zod";

/**
 * Normalizes a blank/whitespace-only string to `undefined` before the inner
 * schema runs. Needed because `z.string()....optional().or(z.literal("").transform(() => undefined))`
 * only falls through to the empty-string branch when the base schema
 * actively rejects "" (e.g. `.email()`) — a bare `z.string().trim().optional()`
 * happily accepts "" as a valid non-empty value, so blank optional fields
 * (locationId, phone, etc.) were silently passing through as "" instead of
 * undefined, which downstream broke `foo ?? null` fallbacks and could hit a
 * Prisma foreign-key error on an empty-string id. Also normalizes `null`
 * (FormData.get returns null, not undefined, for a field that isn't
 * present at all — e.g. a conditionally-rendered locationId input).
 */
export function optionalTrimmedString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val == null || (typeof val === "string" && val.trim() === "") ? undefined : val),
    schema.optional()
  );
}

/** Shared username/password rules used across create + reset flows. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens.");

export const nameSchema = z.string().trim().min(1, "Required").max(100);

export const optionalEmailSchema = optionalTrimmedString(z.string().trim().email("Enter a valid email address."));

export const optionalPhoneSchema = optionalTrimmedString(z.string().trim().max(30));

export const createStaffUserSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  username: usernameSchema,
  password: z.string(),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  locationId: optionalTrimmedString(z.string().trim()),
  locationManagerId: optionalTrimmedString(z.string().trim()),
  managerId: optionalTrimmedString(z.string().trim()),
  offshoreOffice: optionalTrimmedString(z.enum(["LOCATION_1", "LOCATION_2"])),
  technology: optionalTrimmedString(z.string().trim().max(100)),
});

export const visaTypeSchema = z.enum(
  ["CPT", "INITIAL_OPT", "STEM_OPT", "H1B", "H4EAD", "GC", "US_CITIZEN"],
  { message: "Select a visa type." }
);

export const dateOfBirthSchema = z.coerce
  .date({ message: "Enter a valid date of birth." })
  .refine((d) => d.getTime() < Date.now(), { message: "Date of birth must be in the past." });

export const createConsultantSchema = createStaffUserSchema.extend({
  coordinatorId: z.string().trim().min(1, "A coordinator must own this consultant."),
  offshoreOffice: z.enum(["LOCATION_1", "LOCATION_2"], { message: "Select an offshore office." }),
  technology: z.string().trim().min(1, "Select or enter a technology.").max(100),
  visaType: visaTypeSchema,
  dateOfBirth: dateOfBirthSchema,
  trainerUserId: optionalTrimmedString(z.string().trim()),
  otterTeamUserId: optionalTrimmedString(z.string().trim()),
});

export const assignTrainerSchema = z.object({
  trainerUserId: optionalTrimmedString(z.string().trim()),
});

export const assignOtterTeamSchema = z.object({
  otterTeamUserId: optionalTrimmedString(z.string().trim()),
});

export const submitFeedbackSchema = z.object({
  verdict: z.enum(["READY", "NOT_READY"], { message: "Select a verdict." }),
  notes: optionalTrimmedString(z.string().trim().max(1000)),
});

// Plain z.string().url() accepts javascript:/data: URIs (verified: it just
// checks the string parses as a URL, not the scheme) — this value gets
// rendered straight into an <a href> on the consultant's profile page, so a
// non-http(s) scheme here is a stored XSS vector, not just a bad link.
const httpUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL.")
  .max(500)
  .refine((url) => /^https?:\/\//i.test(url), { message: "Link must start with http:// or https://." });

export const calendlyLinkSchema = z.object({
  calendlyLink: optionalTrimmedString(httpUrlSchema),
});

export const updateConsultantVisaDobSchema = z.object({
  visaType: visaTypeSchema,
  dateOfBirth: dateOfBirthSchema,
});

export const updateProfileFieldsSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
});

export const profileChangeRequestSchema = z.object({
  field: z.enum(["firstName", "lastName", "email", "phone", "username"]),
  desiredValue: z.string().trim().min(1, "Enter the new value.").max(200),
  note: optionalTrimmedString(z.string().trim().max(500)),
});

export const createLocationSchema = z.object({
  name: nameSchema,
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters.")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Code can only contain letters, numbers, and hyphens."),
});
