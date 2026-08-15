import { describe, it, expect } from "vitest";
import { isAllowedUploadPathname } from "@/lib/validation/forms";

describe("isAllowedUploadPathname", () => {
  it("accepts a pathname the client would actually generate", () => {
    expect(isAllowedUploadPathname("forms/intake-ab12/fld_1-uuid-resume.pdf", "intake-ab12", "fld_1")).toBe(true);
  });

  it("rejects a pathname pointing at a different form's slug", () => {
    expect(isAllowedUploadPathname("forms/other-form/fld_1-uuid-resume.pdf", "intake-ab12", "fld_1")).toBe(false);
  });

  it("rejects a pathname pointing at a different field within the same form", () => {
    expect(isAllowedUploadPathname("forms/intake-ab12/fld_2-uuid-resume.pdf", "intake-ab12", "fld_1")).toBe(false);
  });

  it("rejects a field id that is only a prefix of the real field id", () => {
    expect(isAllowedUploadPathname("forms/intake-ab12/fld_10-uuid-resume.pdf", "intake-ab12", "fld_1")).toBe(false);
  });

  it("rejects a pathname outside the forms/ namespace entirely", () => {
    expect(isAllowedUploadPathname("avatars/fld_1-uuid-resume.pdf", "intake-ab12", "fld_1")).toBe(false);
  });
});
