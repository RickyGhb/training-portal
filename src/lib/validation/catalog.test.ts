import { describe, it, expect } from "vitest";
import { videoSchema, videoEditSchema, trainingPathSchema, courseSchema } from "@/lib/validation/catalog";

describe("videoSchema.durationSeconds", () => {
  const base = { title: "Intro", driveUrl: "https://drive.google.com/file/d/1234567890/view" };

  it("treats an empty string as absent (undefined)", () => {
    const result = videoSchema.parse({ ...base, durationSeconds: "" });
    expect(result.durationSeconds).toBeUndefined();
  });

  it("treats an omitted field as absent", () => {
    const result = videoSchema.parse({ ...base });
    expect(result.durationSeconds).toBeUndefined();
  });

  it("coerces a numeric string to a number", () => {
    const result = videoSchema.parse({ ...base, durationSeconds: "120" });
    expect(result.durationSeconds).toBe(120);
  });

  it("rejects zero and negative durations", () => {
    expect(videoSchema.safeParse({ ...base, durationSeconds: "0" }).success).toBe(false);
    expect(videoSchema.safeParse({ ...base, durationSeconds: "-5" }).success).toBe(false);
  });

  it("rejects a non-numeric string", () => {
    expect(videoSchema.safeParse({ ...base, durationSeconds: "not-a-number" }).success).toBe(false);
  });

  it("requires a driveUrl", () => {
    expect(videoSchema.safeParse({ title: "Intro" }).success).toBe(false);
  });
});

describe("videoEditSchema", () => {
  it("has no driveUrl field at all — the Drive source link is immutable after creation", () => {
    expect("driveUrl" in videoEditSchema.shape).toBe(false);
  });

  it("still validates title/description/thumbnail/duration like videoSchema", () => {
    const result = videoEditSchema.safeParse({ title: "Updated title", durationSeconds: "60" });
    expect(result.success).toBe(true);
  });

  it("a driveUrl field supplied alongside valid data is simply ignored, not an error", () => {
    // Zod object schemas strip unknown keys by default (non-strict) - confirms
    // videoEditSchema can't be used to sneak an immutable-field change through.
    const result = videoEditSchema.parse({ title: "Updated title", driveUrl: "https://evil.example.com" });
    expect(result).not.toHaveProperty("driveUrl");
  });
});

describe("trainingPathSchema / courseSchema", () => {
  it("both require a non-empty name and accept an optional description", () => {
    expect(trainingPathSchema.safeParse({ name: "" }).success).toBe(false);
    expect(trainingPathSchema.safeParse({ name: "Java Path" }).success).toBe(true);
    expect(courseSchema.safeParse({ name: "Intro to Java", description: "" }).success).toBe(true);
  });
});
