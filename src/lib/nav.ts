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
        { label: "User Management", href: "/users/management", enabled: true },
        { label: "Training Paths", href: "/catalog/training-paths", enabled: true },
        { label: "Courses", href: "/catalog/courses", enabled: true },
        { label: "Videos", href: "/catalog/videos", enabled: true },
        { label: "Exports", href: "/reports/exports", enabled: true },
        { label: "Notifications", href: "/notifications", enabled: true },
        { label: "Audit Logs", href: "/audit-logs", enabled: true },
      ];
    case "LOCATION_MANAGER":
      return [
        dashboard,
        { label: "User Management", href: "/users/management", enabled: true },
        { label: "Training Paths", href: "/catalog/training-paths", enabled: true },
        { label: "Courses", href: "/catalog/courses", enabled: true },
        { label: "Videos", href: "/catalog/videos", enabled: true },
        { label: "Exports", href: "/reports/exports", enabled: true },
      ];
    case "LOCATION_ADMIN":
      return [
        dashboard,
        { label: "User Management", href: "/users/management", enabled: true },
        { label: "Videos", href: "/catalog/videos", enabled: true },
        { label: "Exports", href: "/reports/exports", enabled: true },
      ];
    case "COORDINATOR":
      return [
        dashboard,
        { label: "User Management", href: "/users/management", enabled: true },
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
