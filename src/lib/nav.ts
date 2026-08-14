import type { Role } from "@/generated/prisma/client";

export type NavItem = { label: string; href: string; enabled: boolean };

/**
 * Role-aware navigation per Technical Implementation Blueprint.md §16.
 * Items are marked `enabled: false` until their phase lands so the nav
 * reflects the full intended structure without linking to 404s.
 */
export function navItemsForRole(role: Role): NavItem[] {
  const dashboard: NavItem = { label: "Dashboard", href: "/dashboard", enabled: true };
  const forms: NavItem = { label: "Forms", href: "/forms", enabled: true };

  switch (role) {
    case "CEO":
      return [
        dashboard,
        { label: "Locations", href: "/locations", enabled: true },
        { label: "User Management", href: "/users/management", enabled: true },
        { label: "Training Paths", href: "/catalog/training-paths", enabled: true },
        { label: "Courses", href: "/catalog/courses", enabled: true },
        { label: "Videos", href: "/catalog/videos", enabled: true },
        forms,
        { label: "Exports", href: "/reports/exports", enabled: true },
        { label: "Offshore Data", href: "/offshore/consultants", enabled: true },
        { label: "Location Overview", href: "/location-overview", enabled: true },
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
        forms,
        { label: "Exports", href: "/reports/exports", enabled: true },
        { label: "Location Overview", href: "/location-overview", enabled: true },
      ];
    case "LOCATION_ADMIN":
      return [
        dashboard,
        { label: "User Management", href: "/users/management", enabled: true },
        { label: "Videos", href: "/catalog/videos", enabled: true },
        forms,
        { label: "Location Overview", href: "/location-overview", enabled: true },
      ];
    case "COORDINATOR":
      return [
        dashboard,
        { label: "User Management", href: "/users/management", enabled: true },
        { label: "Profile Requests", href: "/profile-requests", enabled: true },
        forms,
        { label: "Location Overview", href: "/location-overview", enabled: true },
      ];
    case "CONSULTANT":
      return [
        { label: "My Dashboard", href: "/dashboard", enabled: true },
        { label: "My Courses", href: "/my-courses", enabled: true },
      ];
    case "OFFSHORE_MANAGER":
      return [
        dashboard,
        { label: "Consultant Data", href: "/offshore/consultants", enabled: true },
        { label: "Team Leads", href: "/offshore/team-leads", enabled: true },
        forms,
      ];
    case "OFFSHORE_TEAM_LEAD":
      return [dashboard, { label: "My Consultants", href: "/offshore/my-consultants", enabled: true }, forms];
    case "TRAINER":
      return [dashboard, { label: "My Consultants", href: "/trainer/consultants", enabled: true }, forms];
    case "OTTER_TEAM":
      return [dashboard, { label: "My Consultants", href: "/otter/consultants", enabled: true }, forms];
    default:
      return [dashboard];
  }
}
