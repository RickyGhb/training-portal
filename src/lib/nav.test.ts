import { describe, it, expect } from "vitest";
import type { Role } from "@/generated/prisma/client";
import { navItemsForRole } from "@/lib/nav";

function hrefs(role: Role): string[] {
  return navItemsForRole(role).map((item) => item.href);
}

describe("navItemsForRole", () => {
  it("CEO gets the full 12-item nav, including Forms", () => {
    expect(hrefs("CEO")).toEqual([
      "/dashboard",
      "/locations",
      "/users/management",
      "/catalog/training-paths",
      "/catalog/courses",
      "/catalog/videos",
      "/forms",
      "/reports/exports",
      "/offshore/consultants",
      "/location-overview",
      "/notifications",
      "/audit-logs",
    ]);
  });

  it("LOCATION_MANAGER gets 8 items including Forms, no Locations/Audit Logs/Notifications", () => {
    const items = hrefs("LOCATION_MANAGER");
    expect(items).toHaveLength(8);
    expect(items).toContain("/forms");
    expect(items).not.toContain("/locations");
    expect(items).not.toContain("/audit-logs");
  });

  it("LOCATION_ADMIN gets 5 items including Forms, no catalog structure access", () => {
    const items = hrefs("LOCATION_ADMIN");
    expect(items).toEqual(["/dashboard", "/users/management", "/catalog/videos", "/forms", "/location-overview"]);
  });

  it("COORDINATOR gets 5 items including Profile Requests and Forms", () => {
    expect(hrefs("COORDINATOR")).toEqual([
      "/dashboard",
      "/users/management",
      "/profile-requests",
      "/forms",
      "/location-overview",
    ]);
  });

  it("CONSULTANT gets a differently-labeled 'My Dashboard', not the shared dashboard item, and no Forms access", () => {
    const items = navItemsForRole("CONSULTANT");
    expect(items).toEqual([
      { label: "My Dashboard", href: "/dashboard", enabled: true },
      { label: "My Courses", href: "/my-courses", enabled: true },
    ]);
  });

  it("OFFSHORE_MANAGER gets Consultant Data + Team Leads + Forms", () => {
    expect(hrefs("OFFSHORE_MANAGER")).toEqual([
      "/dashboard",
      "/offshore/consultants",
      "/offshore/team-leads",
      "/forms",
    ]);
  });

  it("OFFSHORE_TEAM_LEAD gets My Consultants pointed at /offshore/my-consultants, plus Forms", () => {
    expect(hrefs("OFFSHORE_TEAM_LEAD")).toEqual(["/dashboard", "/offshore/my-consultants", "/forms"]);
  });

  it("TRAINER gets My Consultants pointed at /trainer/consultants, plus Forms", () => {
    expect(hrefs("TRAINER")).toEqual(["/dashboard", "/trainer/consultants", "/forms"]);
  });

  it("OTTER_TEAM gets My Consultants pointed at /otter/consultants, plus Forms", () => {
    expect(hrefs("OTTER_TEAM")).toEqual(["/dashboard", "/otter/consultants", "/forms"]);
  });

  it("every role except CONSULTANT includes /forms", () => {
    const nonConsultantRoles: Role[] = [
      "CEO",
      "LOCATION_MANAGER",
      "LOCATION_ADMIN",
      "COORDINATOR",
      "OFFSHORE_MANAGER",
      "OFFSHORE_TEAM_LEAD",
      "TRAINER",
      "OTTER_TEAM",
    ];
    for (const role of nonConsultantRoles) {
      expect(hrefs(role)).toContain("/forms");
    }
    expect(hrefs("CONSULTANT")).not.toContain("/forms");
  });

  it("every role gets exactly one dashboard-ish entry as the first item", () => {
    const allRoles: Role[] = [
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
    for (const role of allRoles) {
      const items = navItemsForRole(role);
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].href).toBe("/dashboard");
    }
  });
});
