import { describe, it, expect } from "vitest";
import { buildSubmissionWhere, formatAnswerValue } from "@/lib/formResponses";

describe("formatAnswerValue", () => {
  it("renders a missing answer as an empty string", () => {
    // A respondent who skipped an optional question has no FormAnswer row at
    // all — the grid must still render a cell for that column.
    expect(formatAnswerValue(undefined)).toBe("");
  });

  it("renders single-value answers from valueText", () => {
    expect(formatAnswerValue({ valueText: "Jane Doe", valueJson: null })).toBe("Jane Doe");
    expect(formatAnswerValue({ valueText: "2026-08-18", valueJson: null })).toBe("2026-08-18");
  });

  it("joins CHECKBOXES answers stored in valueJson", () => {
    expect(formatAnswerValue({ valueText: null, valueJson: ["Java", "React"] })).toBe("Java, React");
  });

  it("prefers valueJson over valueText when both are set", () => {
    expect(formatAnswerValue({ valueText: "ignored", valueJson: ["A"] })).toBe("A");
  });

  it("renders an empty checkbox selection as an empty string", () => {
    expect(formatAnswerValue({ valueText: null, valueJson: [] })).toBe("");
  });

  it("drops null entries inside a checkbox array rather than printing 'null'", () => {
    expect(formatAnswerValue({ valueText: null, valueJson: ["A", null, "B"] })).toBe("A, B");
  });

  it("renders a null answer value as an empty string", () => {
    expect(formatAnswerValue({ valueText: null, valueJson: null })).toBe("");
  });
});

describe("buildSubmissionWhere", () => {
  const scoped = { locationId: "loc-a" };

  it("a full-access viewer is scoped only by the form", () => {
    expect(buildSubmissionWhere("form-1", scoped, true, {})).toEqual({ formId: "form-1" });
  });

  it("a location-scoped viewer is additionally pinned to their own location", () => {
    expect(buildSubmissionWhere("form-1", scoped, false, {})).toEqual({
      formId: "form-1",
      locationId: "loc-a",
    });
  });

  it("AND-s filters alongside the scope instead of merging into it", () => {
    const where = buildSubmissionWhere("form-1", scoped, true, { q: "jane" });
    expect(where.AND).toBeDefined();
    expect((where.AND as unknown[])[0]).toEqual({ formId: "form-1" });
  });

  it("keeps the location scope intact under every filter combination", () => {
    // The security-relevant property: a filter may only ever narrow within the
    // viewer's scope, never replace or widen it.
    const combinations = [
      { q: "jane" },
      { from: "2026-08-01" },
      { to: "2026-08-31" },
      { q: "jane", from: "2026-08-01", to: "2026-08-31" },
    ];
    for (const filters of combinations) {
      const where = buildSubmissionWhere("form-1", scoped, false, filters);
      expect((where.AND as unknown[])[0]).toEqual({ formId: "form-1", locationId: "loc-a" });
    }
  });

  it("ignores blank and whitespace-only search terms", () => {
    expect(buildSubmissionWhere("form-1", scoped, true, { q: "   " })).toEqual({ formId: "form-1" });
    expect(buildSubmissionWhere("form-1", scoped, true, { q: "" })).toEqual({ formId: "form-1" });
  });

  it("searches answer text case-insensitively", () => {
    const where = buildSubmissionWhere("form-1", scoped, true, { q: " jane " });
    expect((where.AND as unknown[])[1]).toEqual({
      answers: { some: { valueText: { contains: "jane", mode: "insensitive" } } },
    });
  });

  it("includes the whole of the 'to' day rather than cutting off at midnight", () => {
    const where = buildSubmissionWhere("form-1", scoped, true, { to: "2026-08-18" });
    const dateFilter = (where.AND as { submittedAt: { lte: Date } }[])[1].submittedAt;
    expect(dateFilter.lte.getHours()).toBe(23);
    expect(dateFilter.lte.getMinutes()).toBe(59);
  });

  it("ignores an unparseable date instead of erroring or matching nothing", () => {
    expect(buildSubmissionWhere("form-1", scoped, true, { from: "not-a-date" })).toEqual({ formId: "form-1" });
  });

  it("ORs checkbox matches alongside the text search when there are any", () => {
    // CHECKBOXES answers live in valueJson, so their submission ids are
    // resolved separately and folded in here.
    const where = buildSubmissionWhere("form-1", scoped, true, { q: "react" }, ["sub-1", "sub-2"]);
    expect((where.AND as { OR: unknown[] }[])[1].OR).toEqual([
      { answers: { some: { valueText: { contains: "react", mode: "insensitive" } } } },
      { id: { in: ["sub-1", "sub-2"] } },
    ]);
  });

  it("omits the OR entirely when no checkbox answer matched", () => {
    const where = buildSubmissionWhere("form-1", scoped, true, { q: "react" }, []);
    expect((where.AND as unknown[])[1]).toEqual({
      answers: { some: { valueText: { contains: "react", mode: "insensitive" } } },
    });
  });

  it("keeps the location scope constraining checkbox matches too", () => {
    // The important property: a checkbox hit in another location must not
    // become visible just because its id appears in the OR branch.
    const where = buildSubmissionWhere("form-1", scoped, false, { q: "react" }, ["sub-elsewhere"]);
    expect((where.AND as unknown[])[0]).toEqual({ formId: "form-1", locationId: "loc-a" });
  });

  it("ignores checkbox matches when no search term was given", () => {
    expect(buildSubmissionWhere("form-1", scoped, true, {}, ["sub-1"])).toEqual({ formId: "form-1" });
  });
});
