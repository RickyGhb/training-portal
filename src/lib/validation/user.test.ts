import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  optionalTrimmedString,
  usernameSchema,
  nameSchema,
  dateOfBirthSchema,
  createStaffUserSchema,
  createConsultantSchema,
  calendlyLinkSchema,
} from "@/lib/validation/user";
import { UserFacingError } from "@/lib/errors";

describe("optionalTrimmedString", () => {
  const schema = optionalTrimmedString(z.string().trim());

  it.each([null, undefined, "", "   "])("collapses %j to undefined", (input) => {
    expect(schema.parse(input)).toBeUndefined();
  });

  it("passes non-empty-after-trim values through trimmed", () => {
    expect(schema.parse("  hello  ")).toBe("hello");
  });
});

describe("usernameSchema", () => {
  it("accepts letters, numbers, dots, underscores, and hyphens", () => {
    expect(usernameSchema.parse("john.doe-99_x")).toBe("john.doe-99_x");
  });

  it("rejects spaces and other special characters", () => {
    expect(usernameSchema.safeParse("john doe").success).toBe(false);
    expect(usernameSchema.safeParse("john@doe").success).toBe(false);
  });

  it("enforces the 3-character minimum", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("abc").success).toBe(true);
  });

  it("enforces the 50-character maximum", () => {
    expect(usernameSchema.safeParse("a".repeat(50)).success).toBe(true);
    expect(usernameSchema.safeParse("a".repeat(51)).success).toBe(false);
  });
});

describe("nameSchema", () => {
  it("rejects an empty string", () => {
    expect(nameSchema.safeParse("").success).toBe(false);
  });

  it("accepts a normal name", () => {
    expect(nameSchema.parse("Ricky")).toBe("Ricky");
  });
});

describe("calendlyLinkSchema (XSS fix)", () => {
  it("rejects javascript: URIs even though they pass a bare z.string().url()", () => {
    expect(z.string().url().safeParse("javascript:alert(1)").success).toBe(true); // documents the bug this schema fixes
    expect(calendlyLinkSchema.safeParse({ calendlyLink: "javascript:alert(1)" }).success).toBe(false);
  });

  it("rejects data: URIs", () => {
    expect(calendlyLinkSchema.safeParse({ calendlyLink: "data:text/html,<script>alert(1)</script>" }).success).toBe(false);
  });

  it("accepts http:// and https:// links", () => {
    expect(calendlyLinkSchema.safeParse({ calendlyLink: "https://calendly.com/ricky" }).success).toBe(true);
    expect(calendlyLinkSchema.safeParse({ calendlyLink: "http://calendly.com/ricky" }).success).toBe(true);
  });

  it("accepts the scheme case-insensitively", () => {
    expect(calendlyLinkSchema.safeParse({ calendlyLink: "HTTPS://calendly.com/ricky" }).success).toBe(true);
  });

  it("treats a blank link as absent (optional field)", () => {
    expect(calendlyLinkSchema.parse({ calendlyLink: "" })).toEqual({ calendlyLink: undefined });
  });
});

describe("dateOfBirthSchema", () => {
  it("rejects a future date", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(dateOfBirthSchema.safeParse(future.toISOString()).success).toBe(false);
  });

  it("accepts a past date", () => {
    expect(dateOfBirthSchema.safeParse("1990-01-01").success).toBe(true);
  });

  it("rejects an invalid date string", () => {
    expect(dateOfBirthSchema.safeParse("not-a-date").success).toBe(false);
  });
});

describe("createConsultantSchema vs createStaffUserSchema required-field differences", () => {
  const base = {
    firstName: "Ricky",
    lastName: "Bobby",
    username: "ricky.bobby",
    password: "irrelevant-for-schema",
  };

  it("createStaffUserSchema does not require offshoreOffice/technology/visaType/dateOfBirth", () => {
    expect(createStaffUserSchema.safeParse(base).success).toBe(true);
  });

  it("createConsultantSchema requires coordinatorId, offshoreOffice, technology, visaType, and dateOfBirth", () => {
    expect(createConsultantSchema.safeParse(base).success).toBe(false);

    expect(
      createConsultantSchema.safeParse({
        ...base,
        coordinatorId: "coord-1",
        offshoreOffice: "LOCATION_1",
        technology: "Java Developer",
        visaType: "H1B",
        dateOfBirth: "1990-01-01",
      }).success
    ).toBe(true);
  });
});

describe("UserFacingError", () => {
  it("is a real Error subclass distinguishable via instanceof", () => {
    const err = new UserFacingError("That username is already taken.");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.message).toBe("That username is already taken.");

    const plain = new Error("raw internal error");
    expect(plain).not.toBeInstanceOf(UserFacingError);
  });
});
