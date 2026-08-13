import { z } from "zod";
import { nameSchema, optionalTrimmedString } from "@/lib/validation/user";

export const descriptionSchema = optionalTrimmedString(z.string().trim().max(2000));

export const technologySchema = optionalTrimmedString(z.string().trim().max(100));

export const trainingPathSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  technology: technologySchema,
});

export const courseSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});

export const videoSchema = z.object({
  title: nameSchema,
  description: descriptionSchema,
  driveUrl: z.string().trim().min(1, "A Google Drive link is required."),
  thumbnailUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  durationSeconds: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((val) => (val ? Number(val) : undefined))
    .refine((val) => val === undefined || (Number.isFinite(val) && val > 0), {
      message: "Duration must be a positive number of seconds.",
    }),
});

/** Video edit allows metadata changes only — the Drive source link is immutable once created. */
export const videoEditSchema = z.object({
  title: nameSchema,
  description: descriptionSchema,
  thumbnailUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  durationSeconds: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((val) => (val ? Number(val) : undefined))
    .refine((val) => val === undefined || (Number.isFinite(val) && val > 0), {
      message: "Duration must be a positive number of seconds.",
    }),
});
