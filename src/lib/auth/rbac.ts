import type { OffshoreOffice, Role } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Central authorization module. Every protected route/server action must go
 * through these functions — the RBAC matrix must never be re-implemented
 * ad hoc per route, and the frontend must never be trusted as the sole gate.
 * Source of truth: Technical Implementation Blueprint.md §7, §22.
 */

const ROLE_RANK: Record<Role, number> = {
  CEO: 4,
  LOCATION_MANAGER: 3,
  LOCATION_ADMIN: 2,
  COORDINATOR: 1,
  CONSULTANT: 0,
  // Offshore Manager / Team Lead form their own small hierarchy, parallel to
  // the location-based one above — ranked only so canCreateRole/isHigherOrEqualRank
  // work between just those two. Trainer/Otter Team manage no one, so they sit
  // at the Consultant tier.
  OFFSHORE_MANAGER: 1,
  OFFSHORE_TEAM_LEAD: 0,
  TRAINER: 0,
  OTTER_TEAM: 0,
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
  offshoreOffice?: OffshoreOffice | null;
  offshoreTeamLeadId?: string | null;
  trainerUserId?: string | null;
  otterTeamUserId?: string | null;
};

/** Which roles each role is allowed to CREATE. */
const CREATABLE_ROLES: Record<Role, Role[]> = {
  CEO: [
    "CEO",
    "LOCATION_MANAGER",
    "LOCATION_ADMIN",
    "COORDINATOR",
    "CONSULTANT",
    "OFFSHORE_MANAGER",
    "TRAINER",
    "OTTER_TEAM",
  ],
  LOCATION_MANAGER: ["LOCATION_ADMIN", "COORDINATOR", "CONSULTANT"],
  LOCATION_ADMIN: ["COORDINATOR", "CONSULTANT"],
  COORDINATOR: ["CONSULTANT"],
  CONSULTANT: [],
  OFFSHORE_MANAGER: ["OFFSHORE_TEAM_LEAD"],
  OFFSHORE_TEAM_LEAD: [],
  TRAINER: [],
  OTTER_TEAM: [],
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
    case "LOCATION_MANAGER":
      // Restricted to own location, and only roles below Location Manager.
      return (
        target.locationId !== null &&
        target.locationId === actor.locationId &&
        ROLE_RANK[target.role] < ROLE_RANK["LOCATION_MANAGER"]
      );
    case "LOCATION_ADMIN":
      // Restricted to own location, and only roles below Location Admin.
      return (
        target.locationId !== null &&
        target.locationId === actor.locationId &&
        ROLE_RANK[target.role] < ROLE_RANK["LOCATION_ADMIN"]
      );
    case "COORDINATOR":
      // Restricted to consultants they own.
      return target.role === "CONSULTANT" && target.coordinatorId === actor.id;
    case "OFFSHORE_MANAGER":
      // Restricted to Offshore Team Leads sharing the same office — lets the
      // existing username/reset-password/deactivate/delete actions work for
      // this role pair without a parallel set of actions.
      return (
        target.role === "OFFSHORE_TEAM_LEAD" &&
        target.offshoreOffice != null &&
        target.offshoreOffice === actor.offshoreOffice
      );
    case "CONSULTANT":
    case "OFFSHORE_TEAM_LEAD":
    case "TRAINER":
    case "OTTER_TEAM":
      return false;
    default:
      return false;
  }
}

/**
 * Can this Offshore Manager view/read this Consultant's full data? Scoped by
 * offshoreOffice, a separate axis from the locationId hierarchy above.
 */
export function canViewAsOffshoreManager(actor: SessionUser, target: ScopeSubject): boolean {
  if (actor.role !== "OFFSHORE_MANAGER") return false;
  return target.role === "CONSULTANT" && target.offshoreOffice !== null && target.offshoreOffice === actor.offshoreOffice;
}

/**
 * Can this Offshore Manager manage this Offshore Team Lead (create, reassign,
 * assign consultants)? Delegates to canManageUser, which already implements
 * this scope rule — any Offshore Manager in the same office can manage any
 * Team Lead in that office, not just the one who created them.
 */
export function canManageTeamLead(actor: SessionUser, target: ScopeSubject): boolean {
  return actor.role === "OFFSHORE_MANAGER" && canManageUser(actor, target);
}

/** Can this Offshore Team Lead view this Consultant (explicitly assigned to them)? */
export function canViewAsTeamLead(actor: SessionUser, target: ScopeSubject): boolean {
  if (actor.role !== "OFFSHORE_TEAM_LEAD") return false;
  return target.role === "CONSULTANT" && target.offshoreTeamLeadId === actor.id;
}

/** Can this Trainer view/give feedback on this Consultant (explicitly assigned to them)? */
export function canViewAsTrainer(actor: SessionUser, target: ScopeSubject): boolean {
  if (actor.role !== "TRAINER") return false;
  return target.role === "CONSULTANT" && target.trainerUserId === actor.id;
}

/** Can this Otter Team member view/give feedback on this Consultant (explicitly assigned to them)? */
export function canViewAsOtterTeam(actor: SessionUser, target: ScopeSubject): boolean {
  if (actor.role !== "OTTER_TEAM") return false;
  return target.role === "CONSULTANT" && target.otterTeamUserId === actor.id;
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

/** Can the actor export reports (CEO, Location Manager only)? */
export function canExportReports(actorRole: Role): boolean {
  return actorRole === "CEO" || actorRole === "LOCATION_MANAGER";
}

/** Can the actor bulk-reassign consultants between coordinators? */
export function canBulkReassign(actorRole: Role): boolean {
  return actorRole === "CEO" || actorRole === "LOCATION_MANAGER" || actorRole === "LOCATION_ADMIN";
}

/**
 * Can the actor manage the structural catalog (create/edit/delete training
 * paths and courses)? Deliberately global/unscoped for Location Manager —
 * Course and TrainingPath have no locationId, so there's no location concept
 * to restrict this to.
 */
export function canManageCatalogStructure(actorRole: Role): boolean {
  return actorRole === "CEO" || actorRole === "LOCATION_MANAGER";
}

/** Can the actor add/edit/delete videos in the shared catalog? */
export function canManageVideos(actorRole: Role): boolean {
  return actorRole === "CEO" || actorRole === "LOCATION_MANAGER" || actorRole === "LOCATION_ADMIN";
}

export type LocationAssignmentMode = "none" | "required" | "optional" | "inherit";

/**
 * How should a location be assigned to a user of `targetRole` being created
 * by `actorRole`? "inherit" means no picker is shown — the server copies the
 * actor's own locationId. "none" means the created user gets no location.
 */
export function locationAssignmentModeFor(actorRole: Role, targetRole: Role): LocationAssignmentMode {
  if (targetRole === "CEO") return "none";
  if (targetRole === "TRAINER" || targetRole === "OTTER_TEAM") return "none";
  if (targetRole === "OFFSHORE_MANAGER" || targetRole === "OFFSHORE_TEAM_LEAD") return "none";
  if (targetRole === "LOCATION_MANAGER") return "required";
  if (targetRole === "LOCATION_ADMIN") {
    return actorRole === "LOCATION_MANAGER" ? "inherit" : "required";
  }
  if (targetRole === "COORDINATOR") {
    if (actorRole === "CEO") return "optional";
    if (actorRole === "LOCATION_MANAGER" || actorRole === "LOCATION_ADMIN") return "inherit";
    return "required";
  }
  return "none";
}

/**
 * How should offshoreOffice be assigned to a user of `targetRole` being
 * created by `actorRole`? Separate concept from locationAssignmentModeFor,
 * which governs the Location *model* (branches) — this governs the
 * OffshoreOffice enum, reused for Offshore Manager/Team Lead's own scope.
 * Consultant's Offshore Office field is handled separately (hardcoded in
 * CreateUserForm's own isConsultant branch, validated in createConsultantSchema)
 * and deliberately not routed through this helper — createStaffUserAction,
 * this function's only caller, is never invoked for role="CONSULTANT".
 */
export function offshoreOfficeAssignmentModeFor(actorRole: Role, targetRole: Role): LocationAssignmentMode {
  if (targetRole === "OFFSHORE_MANAGER") return "required";
  if (targetRole === "OFFSHORE_TEAM_LEAD") return actorRole === "OFFSHORE_MANAGER" ? "inherit" : "required";
  return "none";
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
    case "LOCATION_MANAGER":
      if (!actor.locationId) return { id: "__none__" };
      return {
        locationId: actor.locationId,
        role: { notIn: ["CEO", "LOCATION_MANAGER"] as Role[] },
      };
    case "LOCATION_ADMIN":
      if (!actor.locationId) return { id: "__none__" };
      return {
        locationId: actor.locationId,
        role: { notIn: ["CEO", "LOCATION_MANAGER", "LOCATION_ADMIN"] as Role[] },
      };
    case "COORDINATOR":
      return { coordinatorId: actor.id, role: "CONSULTANT" as Role };
    case "CONSULTANT":
      return { id: actor.id };
    default:
      return { id: "__none__" };
  }
}

/**
 * ---------------------------------------------------------------------------
 * Forms feature RBAC (Phase 2)
 * ---------------------------------------------------------------------------
 * Three independent visibility mechanisms, combined by canViewSubmission:
 *
 *  A. Creator hierarchy (canViewFormsByCreator) — a role can see forms built
 *     by its own subordinates, within its own scope. Mirrors canManageUser's
 *     structure but answers "can I see forms THEY built" rather than "can I
 *     manage THEM directly" — deliberately a separate function, since the
 *     scope rules diverge for Coordinator (canManageUser restricts a
 *     Coordinator to their own consultants; here a Coordinator has no
 *     subordinates who can create forms at all, so this always returns false
 *     for them — their own forms are covered by the id-equality check that
 *     callers layer on top, same pattern canManageUser itself uses).
 *  B. Per-submission location matching (folded into canViewSubmission) — for
 *     forms with a field marked isLocationField, any Location Manager/Admin/
 *     Coordinator whose own locationId matches that submission's resolved
 *     locationId can see THAT submission, regardless of who built the form.
 *  C. Explicit per-person grants (FormAccessGrant) — CEO or the form's own
 *     creator can share a specific form with a specific named person.
 */

/** Minimal shape needed to reason about a form's creator for visibility checks. */
export type FormCreatorSubject = {
  role: Role;
  locationId: string | null;
  offshoreOffice?: OffshoreOffice | null;
};

/** Can the actor create forms? Every role except Consultant. */
export function canCreateForm(actorRole: Role): boolean {
  return actorRole !== "CONSULTANT";
}

/**
 * Mechanism A — can the actor see forms built by this creator, purely by
 * organizational hierarchy (no explicit grant, no location-answer matching)?
 * Does NOT cover "it's the actor's own form" — callers check that separately,
 * same as canManageUser's self-check happens outside this kind of switch.
 */
export function canViewFormsByCreator(actor: SessionUser, creator: FormCreatorSubject): boolean {
  switch (actor.role) {
    case "CEO":
      return true;
    case "LOCATION_MANAGER":
      return (
        creator.locationId !== null &&
        creator.locationId === actor.locationId &&
        (creator.role === "LOCATION_ADMIN" || creator.role === "COORDINATOR")
      );
    case "LOCATION_ADMIN":
      return creator.locationId !== null && creator.locationId === actor.locationId && creator.role === "COORDINATOR";
    case "OFFSHORE_MANAGER":
      return (
        creator.offshoreOffice != null &&
        creator.offshoreOffice === actor.offshoreOffice &&
        creator.role === "OFFSHORE_TEAM_LEAD"
      );
    default:
      return false;
  }
}

/** Can the actor grant (or revoke) another specific person's access to this form? CEO or its creator. */
export function canGrantFormAccess(actor: SessionUser, form: { createdByUserId: string | null }): boolean {
  return isCeo(actor.role) || actor.id === form.createdByUserId;
}

/**
 * Can the actor see this form at all (its structure, and by extension every
 * submission on it)? Own form, CEO, Mechanism A hierarchy, or an explicit
 * Mechanism C grant. Does not account for Mechanism B (location-answer
 * matching) — that only ever grants visibility into individual submissions,
 * never the form as a whole — see canViewSubmission.
 */
export function canViewForm(
  actor: SessionUser,
  form: { createdByUserId: string | null },
  creator: FormCreatorSubject | null,
  hasAccessGrant: boolean
): boolean {
  if (actor.id === form.createdByUserId) return true;
  if (isCeo(actor.role)) return true;
  if (creator && canViewFormsByCreator(actor, creator)) return true;
  return hasAccessGrant;
}

/**
 * Can the actor see this specific submission? Everything canViewForm allows,
 * plus Mechanism B: a Location Manager/Admin/Coordinator whose own location
 * matches the submission's resolved locationId (set when the form has a
 * field marked isLocationField), independent of who built the form or
 * whether an explicit grant exists.
 */
export function canViewSubmission(
  actor: SessionUser,
  form: { createdByUserId: string | null },
  creator: FormCreatorSubject | null,
  hasAccessGrant: boolean,
  submission: { locationId: string | null }
): boolean {
  if (canViewForm(actor, form, creator, hasAccessGrant)) return true;
  if (submission.locationId == null || actor.locationId == null) return false;
  if (actor.role !== "LOCATION_MANAGER" && actor.role !== "LOCATION_ADMIN" && actor.role !== "COORDINATOR") {
    return false;
  }
  return submission.locationId === actor.locationId;
}

/**
 * Builds the Prisma `Form` where-clause for the /forms list — which forms
 * this actor can see (Mechanism A + C only; Mechanism B never surfaces a
 * whole form in the list, only individual submissions within one the actor
 * can already see via A/C/ownership).
 */
export function formsListWhereClause(actor: SessionUser) {
  if (isCeo(actor.role)) return {};

  const ownOrGranted = [
    { createdByUserId: actor.id },
    { accessGrants: { some: { grantedToUserId: actor.id } } },
  ];

  switch (actor.role) {
    case "LOCATION_MANAGER":
      if (!actor.locationId) return { OR: ownOrGranted };
      return {
        OR: [
          ...ownOrGranted,
          { createdBy: { role: "LOCATION_ADMIN" as Role, locationId: actor.locationId } },
          { createdBy: { role: "COORDINATOR" as Role, locationId: actor.locationId } },
        ],
      };
    case "LOCATION_ADMIN":
      if (!actor.locationId) return { OR: ownOrGranted };
      return {
        OR: [...ownOrGranted, { createdBy: { role: "COORDINATOR" as Role, locationId: actor.locationId } }],
      };
    case "OFFSHORE_MANAGER":
      if (!actor.offshoreOffice) return { OR: ownOrGranted };
      return {
        OR: [
          ...ownOrGranted,
          { createdBy: { role: "OFFSHORE_TEAM_LEAD" as Role, offshoreOffice: actor.offshoreOffice } },
        ],
      };
    default:
      return { OR: ownOrGranted };
  }
}
