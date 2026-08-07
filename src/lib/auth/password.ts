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

// Precomputed hash of an arbitrary fixed string, unrelated to any real
// account. Used only to keep login response time roughly constant when the
// username doesn't exist — otherwise skipping the argon2 comparison entirely
// makes "no such user" distinguishable from "wrong password" by timing.
const DUMMY_HASH_FOR_TIMING_SAFETY =
  "$argon2id$v=19$m=19456,p=1,t=2$T34BSBC5y7BtVolJeZ5lEQ$uCA0lL80x4/rZa2JSV/SAkGBq2+1t5JId2UNvXBSyVw";

/** Always runs a real argon2 comparison, even when no user was found, and always returns false in that case. */
export async function verifyPasswordConstantTime(hash: string | null, password: string): Promise<boolean> {
  if (!hash) {
    await verifyPassword(DUMMY_HASH_FOR_TIMING_SAFETY, password);
    return false;
  }
  return verifyPassword(hash, password);
}
