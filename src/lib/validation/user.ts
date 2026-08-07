import { z } from "zod";

/** Shared username/password rules used across create + reset flows. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens.");

export const nameSchema = z.string().trim().min(1, "Required").max(100);

export const optionalEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createStaffUserSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  username: usernameSchema,
  password: z.string(),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  locationId: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  locationManagerId: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  managerId: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
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
