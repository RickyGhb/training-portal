import { describe, it, expect } from "vitest";
import type { Role } from "@/generated/prisma/client";
import { navItemsForRole } from "@/lib/nav";

function hrefs(role: Role): string[] {
  return navItemsForRole(role).map((item) => item.href);
}

describe("navItemsForRole", () => {
  it("CEO gets the full 11-item nav", () => {
    expect(hrefs("CEO")).toEqual([
      "/dashboard",
      "/locations",
      "/users/management",
      "/catalog/training-paths",
      "/catalog/courses",
      "/catalog/videos",
      "/reports/exports",
      "/offshore/consultants",
      "/location-overview",
      "/notifications",
      "/audit-logs",
    ]);
  });

  it("LOCATION_MANAGER gets 7 items, no Locations/Audit Logs/Notifications", () => {
    const items = hrefs("LOCATION_MANAGER");
    expect(items).toHaveLength(7);
    expect(items).not.toContain("/locations");
    expect(items).not.toContain("/audit-logs");
  });

  it("LOCATION_ADMIN gets 4 items, no catalog structure access", () => {
    const items = hrefs("LOCATION_ADMIN");
    expect(items).toEqual(["/dashboard", "/users/management", "/catalog/videos", "/location-overview"]);
  });

  it("COORDINATOR gets 4 items including Profile Requests", () => {
    expect(hrefs("COORDINATOR")).toEqual([
      "/dashboard",
      "/users/management",
      "/profile-requests",
      "/location-overview",
    ]);
  });

  it("CONSULTANT gets a differently-labeled 'My Dashboard', not the shared dashboard item", () => {
    const items = navItemsForRole("CONSULTANT");
    expect(items).toEqual([
      { label: "My Dashboard", href: "/dashboard", enabled: true },
      { label: "My Courses", href: "/my-courses", enabled: true },
    ]);
  });

  it("OFFSHORE_MANAGER gets Consultant Data + Team Leads", () => {
    expect(hrefs("OFFSHORE_MANAGER")).toEqual(["/dashboard", "/offshore/consultants", "/offshore/team-leads"]);
  });

  it("OFFSHORE_TEAM_LEAD gets My Consultants pointed at /offshore/my-consultants", () => {
    expect(hrefs("OFFSHORE_TEAM_LEAD")).toEqual(["/dashboard", "/offshore/my-consultants"]);
  });

  it("TRAINER gets My Consultants pointed at /trainer/consultants", () => {
    expect(hrefs("TRAINER")).toEqual(["/dashboard", "/trainer/consultants"]);
  });

  it("OTTER_TEAM gets My Consultants pointed at /otter/consultants", () => {
    expect(hrefs("OTTER_TEAM")).toEqual(["/dashboard", "/otter/consultants"]);
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
