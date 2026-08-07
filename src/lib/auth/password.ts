import * as argon2 from "argon2";
import type { HashOptions } from "argon2";

const HASH_OPTIONS: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, OWASP minimum recommendation for argon2id
  timeCost: 2,
  parallelism: 1,
};

const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "letmein123",
  "admin1234",
  "welcome123",
]);

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (password.length < 10) {
    return { valid: false, reason: "Password must be at least 10 characters long." };
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, reason: "Password is too common. Choose a stronger password." };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
