import type { Role } from "@/generated/prisma/client";

export type NavItem = { label: string; href: string; enabled: boolean };

/**
 * Role-aware navigation per Technical Implementation Blueprint.md §16.
 * Items are marked `enabled: false` until their phase lands so the nav
 * reflects the full intended structure without linking to 404s.
 */
export function navItemsForRole(role: Role): NavItem[] {
  const dashboard: NavItem = { label: "Dashboard", href: "/dashboard", enabled: true };

  switch (role) {
    case "CEO":
      return [
        dashboard,
        { label: "Locations", href: "/locations", enabled: true },
        { label: "Managers", href: "/users/managers", enabled: true },
        { label: "Location Managers", href: "/users/location-managers", enabled: true },
        { label: "Coordinators", href: "/users/coordinators", enabled: true },
        { label: "Consultants", href: "/users/consultants", enabled: true },
        { label: "Bulk Reassignment", href: "/users/bulk-reassign", enabled: true },
        { label: "Training Paths", href: "/catalog/training-paths", enabled: true },
        { label: "Courses", href: "/catalog/courses", enabled: true },
        { label: "Videos", href: "/catalog/videos", enabled: true },
        { label: "Reports", href: "/reports", enabled: false },
        { label: "Exports", href: "/reports/exports", enabled: false },
        { label: "Notifications", href: "/notifications", enabled: false },
        { label: "Audit Logs", href: "/audit-logs", enabled: false },
      ];
    case "MANAGER":
      return [
        dashboard,
        { label: "Location Managers", href: "/users/location-managers", enabled: true },
        { label: "Coordinators", href: "/users/coordinators", enabled: true },
        { label: "Consultants", href: "/users/consultants", enabled: true },
        { label: "Bulk Reassignment", href: "/users/bulk-reassign", enabled: true },
        { label: "Videos", href: "/catalog/videos", enabled: true },
        { label: "Reports", href: "/reports", enabled: false },
        { label: "Exports", href: "/reports/exports", enabled: false },
      ];
    case "LOCATION_MANAGER":
      return [
        dashboard,
        { label: "Coordinators", href: "/users/coordinators", enabled: true },
        { label: "Consultants", href: "/users/consultants", enabled: true },
        { label: "Bulk Reassignment", href: "/users/bulk-reassign", enabled: true },
        { label: "Videos", href: "/catalog/videos", enabled: true },
        { label: "Reports", href: "/reports", enabled: false },
        { label: "Exports", href: "/reports/exports", enabled: false },
      ];
    case "COORDINATOR":
      return [
        dashboard,
        { label: "My Consultants", href: "/users/consultants", enabled: true },
        { label: "Progress", href: "/consultants/progress", enabled: false },
      ];
    case "CONSULTANT":
      return [
        { label: "My Dashboard", href: "/dashboard", enabled: true },
        { label: "My Courses", href: "/my-courses", enabled: true },
      ];
    default:
      return [dashboard];
  }
}
