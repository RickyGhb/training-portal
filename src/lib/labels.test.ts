import { describe, it, expect } from "vitest";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { OFFSHORE_OFFICE_LABELS } from "@/lib/offshoreOfficeLabels";
import { VISA_TYPE_LABELS } from "@/lib/visaTypeLabels";

// Guards against schema-enum drift: if Role/OffshoreOffice/VisaType ever gains
// or loses a value in prisma/schema.prisma, these label maps must be updated
// to match or the UI silently shows "undefined" for the new value.

describe("ROLE_LABELS", () => {
  it("has a label for every one of the 9 roles, all non-empty", () => {
    const expectedKeys = [
      "CEO",
      "LOCATION_MANAGER",
      "LOCATION_ADMIN",
      "COORDINATOR",
      "CONSULTANT",
      "OFFSHORE_MANAGER",
      "OFFSHORE_TEAM_LEAD",
      "TRAINER",
      "OTTER_TEAM",
    ];
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(expectedKeys.sort());
    for (const key of expectedKeys) {
      expect(ROLE_LABELS[key as keyof typeof ROLE_LABELS]).toBeTruthy();
    }
  });
});

describe("OFFSHORE_OFFICE_LABELS", () => {
  it("has a label for both offices", () => {
    expect(Object.keys(OFFSHORE_OFFICE_LABELS).sort()).toEqual(["LOCATION_1", "LOCATION_2"]);
  });
});

describe("VISA_TYPE_LABELS", () => {
  it("has a label for all 7 visa types", () => {
    const expectedKeys = ["CPT", "INITIAL_OPT", "STEM_OPT", "H1B", "H4EAD", "GC", "US_CITIZEN"];
    expect(Object.keys(VISA_TYPE_LABELS).sort()).toEqual(expectedKeys.sort());
  });
});
