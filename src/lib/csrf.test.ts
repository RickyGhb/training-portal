import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

const cookiesMock = vi.fn();
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

function mockSessionCookie(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === "tp_session" && value !== undefined ? { value } : undefined),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCsrfToken", () => {
  it("returns null when there's no session cookie", async () => {
    mockSessionCookie(undefined);
    const { getCsrfToken } = await import("@/lib/csrf");
    expect(await getCsrfToken()).toBeNull();
  });

  it("derives a deterministic sha256 hash from the session cookie value", async () => {
    mockSessionCookie("fixed-session-token");
    const { getCsrfToken } = await import("@/lib/csrf");
    const token = await getCsrfToken();

    const expected = createHash("sha256").update("csrf:fixed-session-token").digest("hex");
    expect(token).toBe(expected);
  });

  it("produces different tokens for different session cookies", async () => {
    mockSessionCookie("session-a");
    const { getCsrfToken } = await import("@/lib/csrf");
    const tokenA = await getCsrfToken();

    mockSessionCookie("session-b");
    const tokenB = await getCsrfToken();

    expect(tokenA).not.toBe(tokenB);
  });
});

describe("verifyCsrfToken", () => {
  it("accepts a token that matches the derived token for the current session", async () => {
    mockSessionCookie("fixed-session-token");
    const { getCsrfToken, verifyCsrfToken } = await import("@/lib/csrf");
    const valid = await getCsrfToken();
    expect(await verifyCsrfToken(valid)).toBe(true);
  });

  it("rejects a mismatched token", async () => {
    mockSessionCookie("fixed-session-token");
    const { verifyCsrfToken } = await import("@/lib/csrf");
    expect(await verifyCsrfToken("a".repeat(64))).toBe(false);
  });

  it("rejects null", async () => {
    mockSessionCookie("fixed-session-token");
    const { verifyCsrfToken } = await import("@/lib/csrf");
    expect(await verifyCsrfToken(null)).toBe(false);
  });

  it("rejects a candidate of the wrong length without throwing (timingSafeEqual would throw on mismatched lengths)", async () => {
    mockSessionCookie("fixed-session-token");
    const { verifyCsrfToken } = await import("@/lib/csrf");
    await expect(verifyCsrfToken("too-short")).resolves.toBe(false);
  });

  it("rejects when there's no session cookie at all, even with a well-formed candidate", async () => {
    mockSessionCookie(undefined);
    const { verifyCsrfToken } = await import("@/lib/csrf");
    expect(await verifyCsrfToken("a".repeat(64))).toBe(false);
  });
});
