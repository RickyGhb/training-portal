import type { Role } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Central authorization module. Every protected route/server action must go
 * through these functions — the RBAC matrix must never be re-implemented
 * ad hoc per route, and the frontend must never be trusted as the sole gate.
 * Source of truth: Technical Implementation Blueprint.md §7, §22.
 */

const ROLE_RANK: Record<Role, number> = {
  CEO: 4,
  MANAGER: 3,
  LOCATION_MANAGER: 2,
  COORDINATOR: 1,
  CONSULTANT: 0,
};

export function isHigherOrEqualRank(a: Role, b: Role): boolean {
  return ROLE_RANK[a] >= ROLE_RANK[b];
}

/** Minimal shape of the user record needed for scope checks (subset of the Prisma User model). */
export type ScopeSubject = {
  id: string;
  role: Role;
  locationId: string | null;
  coordinatorId: string | null;
  locationManagerId: string | null;
  managerId: string | null;
};

/** Which roles each role is allowed to CREATE. */
const CREATABLE_ROLES: Record<Role, Role[]> = {
  CEO: ["CEO", "MANAGER", "LOCATION_MANAGER", "COORDINATOR", "CONSULTANT"],
  MANAGER: ["LOCATION_MANAGER", "COORDINATOR", "CONSULTANT"],
  LOCATION_MANAGER: ["COORDINATOR", "CONSULTANT"],
  COORDINATOR: ["CONSULTANT"],
  CONSULTANT: [],
};

export function canCreateRole(actorRole: Role, targetRole: Role): boolean {
  return CREATABLE_ROLES[actorRole].includes(targetRole);
}

/** Which roles this actor is allowed to create, for populating a role picker. */
export function creatableRoles(actorRole: Role): Role[] {
  return CREATABLE_ROLES[actorRole];
}

/**
 * Can the actor manage (view/edit/deactivate/delete/reset-password on) this
 * specific user, given the actor's scope (global / location / owned
 * consultants)?
 */
export function canManageUser(actor: SessionUser, target: ScopeSubject): boolean {
  if (actor.id === target.id) return true; // self is handled by narrower self-service checks elsewhere

  switch (actor.role) {
    case "CEO":
      return true;
    case "MANAGER":
      // Manager can manage everyone except CEO and other Managers.
      return target.role !== "CEO" && target.role !== "MANAGER";
    case "LOCATION_MANAGER":
      // Restricted to own location, and only roles below Location Manager.
      return (
        target.locationId !== null &&
        target.locationId === actor.locationId &&
        ROLE_RANK[target.role] < ROLE_RANK["LOCATION_MANAGER"]
      );
    case "COORDINATOR":
      // Restricted to consultants they own.
      return target.role === "CONSULTANT" && target.coordinatorId === actor.id;
    case "CONSULTANT":
      return false;
    default:
      return false;
  }
}

/** Can the actor assign extra individual courses to this consultant? */
export function canAssignExtraCourses(actor: SessionUser, target: ScopeSubject): boolean {
  if (target.role !== "CONSULTANT") return false;
  if (actor.role === "COORDINATOR" || actor.role === "CONSULTANT") return false;
  return canManageUser(actor, target);
}

/** Can the actor assign/change the primary training path for this consultant? */
export function canAssignTrainingPath(actor: SessionUser, target: ScopeSubject): boolean {
  if (target.role !== "CONSULTANT") return false;
  if (actor.role === "CONSULTANT") return false;
  return canManageUser(actor, target);
}

/** Can the actor export reports (CEO, Manager, Location Manager only)? */
export function canExportReports(actorRole: Role): boolean {
  return actorRole === "CEO" || actorRole === "MANAGER" || actorRole === "LOCATION_MANAGER";
}

/** Can the actor bulk-reassign consultants between coordinators? */
export function canBulkReassign(actorRole: Role): boolean {
  return actorRole === "CEO" || actorRole === "MANAGER" || actorRole === "LOCATION_MANAGER";
}

/** Can the actor manage the structural catalog (create/edit/delete training paths and courses)? */
export function canManageCatalogStructure(actorRole: Role): boolean {
  return actorRole === "CEO";
}

/** Can the actor add/edit/delete videos in the shared catalog? */
export function canManageVideos(actorRole: Role): boolean {
  return actorRole === "CEO" || actorRole === "MANAGER" || actorRole === "LOCATION_MANAGER";
}

/** Can the actor view audit logs / act as the notification recipient (CEO only)? */
export function isCeo(actorRole: Role): boolean {
  return actorRole === "CEO";
}

/**
 * Builds the Prisma `where` scoping clause for "which users can this actor
 * see" — used by list/report endpoints. Returns null for CEO (no filter,
 * i.e. everyone), otherwise a Prisma User where-filter object.
 */
export function userVisibilityFilter(actor: SessionUser) {
  switch (actor.role) {
    case "CEO":
      return {};
    case "MANAGER":
      return { role: { notIn: ["CEO", "MANAGER"] as Role[] } };
    case "LOCATION_MANAGER":
      return {
        locationId: actor.locationId,
        role: { notIn: ["CEO", "MANAGER", "LOCATION_MANAGER"] as Role[] },
      };
    case "COORDINATOR":
      return { coordinatorId: actor.id, role: "CONSULTANT" as Role };
    case "CONSULTANT":
      return { id: actor.id };
    default:
      return { id: "__none__" };
  }
}
