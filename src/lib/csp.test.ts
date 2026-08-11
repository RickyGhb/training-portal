import { describe, it, expect } from "vitest";
import { buildCsp } from "@/lib/csp";

describe("buildCsp", () => {
  it("includes the given nonce in script-src", () => {
    const csp = buildCsp("abc123", true);
    expect(csp).toContain("'nonce-abc123'");
  });

  it("uses strict-dynamic instead of unsafe-inline for script-src", () => {
    const csp = buildCsp("abc123", true);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("omits unsafe-eval in production", () => {
    const csp = buildCsp("abc123", true);
    expect(csp).not.toContain("unsafe-eval");
  });

  it("includes unsafe-eval outside production (React dev-mode debugging needs it)", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("'unsafe-eval'");
  });

  it("blocks plugin/object embeds", () => {
    expect(buildCsp("abc123", true)).toContain("object-src 'none'");
  });

  it("blocks framing except by nothing (frame-ancestors 'none')", () => {
    expect(buildCsp("abc123", true)).toContain("frame-ancestors 'none'");
  });

  it("allows the Google Drive embed frame the video player needs", () => {
    expect(buildCsp("abc123", true)).toContain("frame-src https://drive.google.com");
  });

  it("produces a different nonce value verbatim on each call site (no caching/memoization)", () => {
    const cspA = buildCsp("nonce-a", true);
    const cspB = buildCsp("nonce-b", true);
    expect(cspA).toContain("'nonce-nonce-a'");
    expect(cspB).toContain("'nonce-nonce-b'");
  });
});
