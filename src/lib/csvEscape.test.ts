import { describe, it, expect } from "vitest";
import { csvEscape } from "@/lib/csvEscape";

describe("csvEscape", () => {
  it("passes through an ordinary value unchanged", () => {
    expect(csvEscape("Jane Doe")).toBe("Jane Doe");
  });

  it("quotes and doubles internal quotes when a comma is present", () => {
    expect(csvEscape("Doe, Jane")).toBe('"Doe, Jane"');
  });

  it("quotes and doubles internal quotes when a quote is present", () => {
    expect(csvEscape('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("quotes when a newline is present", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it.each([
    ["=cmd|'/c calc'!A1", "'=cmd|'/c calc'!A1"],
    ["+1234567890", "'+1234567890"],
    ["-1", "'-1"],
    ["@SUM(A1:A2)", "'@SUM(A1:A2)"],
    ["\tHIDDEN", "'\tHIDDEN"],
    ["\rHIDDEN", "'\rHIDDEN"],
  ])("neutralizes a formula-injection payload %s", (input, expected) => {
    expect(csvEscape(input)).toBe(expected);
  });

  it("neutralizes AND quotes when the payload also contains a comma", () => {
    expect(csvEscape("=SUM(1,2)")).toBe('"\'=SUM(1,2)"');
  });

  it("does not treat a mid-string = or @ as a trigger, only a leading one", () => {
    expect(csvEscape("user@example.com")).toBe("user@example.com");
    expect(csvEscape("a=b")).toBe("a=b");
  });
});
