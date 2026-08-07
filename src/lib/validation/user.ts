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
});

export const createConsultantSchema = createStaffUserSchema.extend({
  coordinatorId: z.string().trim().min(1, "A coordinator must own this consultant."),
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
