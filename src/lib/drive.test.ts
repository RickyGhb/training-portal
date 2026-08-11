import { describe, it, expect } from "vitest";
import { parseDriveLink } from "@/lib/drive";

describe("parseDriveLink", () => {
  it("parses the /file/d/<id>/view pattern", () => {
    const result = parseDriveLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing");
    expect(result).toEqual({
      valid: true,
      fileId: "1AbCdEfGhIjKlMnOp",
      embedUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview",
    });
  });

  it("parses the ?id=<id> pattern (open/uc links)", () => {
    const result = parseDriveLink("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp");
    expect(result).toEqual({
      valid: true,
      fileId: "1AbCdEfGhIjKlMnOp",
      embedUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview",
    });
  });

  it("strips a leading www. from the host", () => {
    const result = parseDriveLink("https://www.drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view");
    expect(result.valid).toBe(true);
  });

  it("rejects a non-drive.google.com host", () => {
    const result = parseDriveLink("https://docs.google.com/file/d/1AbCdEfGhIjKlMnOp/view");
    expect(result).toEqual({ valid: false, error: "Link must be a drive.google.com file link." });
  });

  it("rejects a malformed URL", () => {
    const result = parseDriveLink("not a url at all");
    expect(result).toEqual({ valid: false, error: "That doesn't look like a valid URL." });
  });

  it("rejects a file ID shorter than the 10-char minimum", () => {
    const result = parseDriveLink("https://drive.google.com/file/d/short123/view");
    expect(result.valid).toBe(false);
  });

  it("accepts a file ID right at the 10-char boundary", () => {
    const result = parseDriveLink("https://drive.google.com/file/d/1234567890/view");
    expect(result).toEqual({
      valid: true,
      fileId: "1234567890",
      embedUrl: "https://drive.google.com/file/d/1234567890/preview",
    });
  });

  it("trims surrounding whitespace before parsing", () => {
    const result = parseDriveLink("  https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view  ");
    expect(result.valid).toBe(true);
  });

  it("prefers the /file/d/ pattern when both patterns could match", () => {
    const result = parseDriveLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?id=zZzZzZzZzZzZzZ");
    expect(result).toEqual({
      valid: true,
      fileId: "1AbCdEfGhIjKlMnOp",
      embedUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview",
    });
  });

  it("rejects a drive.google.com URL with no recognizable file ID", () => {
    const result = parseDriveLink("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp");
    expect(result.valid).toBe(false);
  });
});
