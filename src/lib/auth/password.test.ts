import { describe, it, expect } from "vitest";
import {
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  verifyPasswordConstantTime,
} from "@/lib/auth/password";

describe("validatePasswordStrength", () => {
  it("rejects passwords under 10 characters", () => {
    const result = validatePasswordStrength("Ab1cd2ef");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/at least 10 characters/);
  });

  it("rejects common weak passwords regardless of case", () => {
    expect(validatePasswordStrength("Password123").valid).toBe(false);
    expect(validatePasswordStrength("WELCOME123").valid).toBe(false);
  });

  it("accepts a long, non-common password", () => {
    const result = validatePasswordStrength("correct-horse-battery-staple-9");
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("accepts exactly the 10-character boundary", () => {
    expect(validatePasswordStrength("Xk7!mQ2p9z").valid).toBe(true);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("produces an argon2id hash that verifies against the original password", async () => {
    const hash = await hashPassword("a-real-password-123");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, "a-real-password-123")).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("a-real-password-123");
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("returns false (not throw) for a malformed hash", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });
}, 15000);

describe("verifyPasswordConstantTime", () => {
  it("returns false for a null hash (no such user) without throwing", async () => {
    await expect(verifyPasswordConstantTime(null, "anything")).resolves.toBe(false);
  });

  it("still verifies correctly against a real hash", async () => {
    const hash = await hashPassword("a-real-password-123");
    await expect(verifyPasswordConstantTime(hash, "a-real-password-123")).resolves.toBe(true);
    await expect(verifyPasswordConstantTime(hash, "wrong")).resolves.toBe(false);
  });
}, 15000);
