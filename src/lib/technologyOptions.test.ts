import { describe, it, expect } from "vitest";
import { deriveOtherAbbrev } from "@/lib/technologyOptions";

describe("deriveOtherAbbrev", () => {
  it("lowercases and strips non-alphanumeric characters", () => {
    expect(deriveOtherAbbrev("Rust Engineer!")).toBe("rustengine");
  });

  it("truncates to 10 characters", () => {
    expect(deriveOtherAbbrev("Kubernetes Specialist")).toBe("kubernetes");
    expect(deriveOtherAbbrev("Kubernetes Specialist").length).toBeLessThanOrEqual(10);
  });

  it("passes through short input unchanged (after lowercasing)", () => {
    expect(deriveOtherAbbrev("Go")).toBe("go");
  });

  it("returns an empty string for empty input", () => {
    expect(deriveOtherAbbrev("")).toBe("");
  });

  it("strips non-ASCII characters entirely", () => {
    expect(deriveOtherAbbrev("Café Développeur")).toBe("cafdveloppe".slice(0, 10));
  });
});
