import { describe, it, expect } from "vitest";
import type { Role, OffshoreOffice } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import {
  isHigherOrEqualRank,
  canCreateRole,
  creatableRoles,
  canManageUser,
  canViewAsOffshoreManager,
  canManageTeamLead,
  canViewAsTeamLead,
  canViewAsTrainer,
  canViewAsOtterTeam,
  canAssignExtraCourses,
  canAssignTrainingPath,
  canExportReports,
  canBulkReassign,
  canManageCatalogStructure,
  canManageVideos,
  locationAssignmentModeFor,
  offshoreOfficeAssignmentModeFor,
  isCeo,
  userVisibilityFilter,
  type ScopeSubject,
} from "@/lib/auth/rbac";

const ALL_ROLES: Role[] = [
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

function user(role: Role, overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "actor-1",
    role,
    status: "ACTIVE",
    firstName: "Test",
    lastName: "User",
    username: "test.user",
    locationId: null,
    managerId: null,
    locationManagerId: null,
    coordinatorId: null,
    offshoreOffice: null,
    offshoreTeamLeadId: null,
    trainerUserId: null,
    otterTeamUserId: null,
    marketingStatus: "IN_TRAINING",
    ...overrides,
  };
}

function target(role: Role, overrides: Partial<ScopeSubject> = {}): ScopeSubject {
  return {
    id: "target-1",
    role,
    locationId: null,
    coordinatorId: null,
    locationManagerId: null,
    managerId: null,
    ...overrides,
  };
}

describe("isHigherOrEqualRank", () => {
  it("compares within the location hierarchy", () => {
    expect(isHigherOrEqualRank("CEO", "LOCATION_MANAGER")).toBe(true);
    expect(isHigherOrEqualRank("LOCATION_MANAGER", "LOCATION_ADMIN")).toBe(true);
    expect(isHigherOrEqualRank("LOCATION_ADMIN", "COORDINATOR")).toBe(true);
    expect(isHigherOrEqualRank("COORDINATOR", "CONSULTANT")).toBe(true);
  });

  it("treats equal ranks as higher-or-equal, including cross-hierarchy ties", () => {
    expect(isHigherOrEqualRank("COORDINATOR", "OFFSHORE_MANAGER")).toBe(true);
    expect(isHigherOrEqualRank("OFFSHORE_MANAGER", "COORDINATOR")).toBe(true);
    expect(isHigherOrEqualRank("CONSULTANT", "TRAINER")).toBe(true);
  });

  it("returns false when actor outranks target the other way", () => {
    expect(isHigherOrEqualRank("CONSULTANT", "COORDINATOR")).toBe(false);
  });
});

describe("canCreateRole / creatableRoles", () => {
  it.each<[Role, Role[]]>([
    ["CEO", ["CEO", "LOCATION_MANAGER", "LOCATION_ADMIN", "COORDINATOR", "CONSULTANT", "OFFSHORE_MANAGER", "TRAINER", "OTTER_TEAM"]],
    ["LOCATION_MANAGER", ["LOCATION_ADMIN", "COORDINATOR", "CONSULTANT"]],
    ["LOCATION_ADMIN", ["COORDINATOR", "CONSULTANT"]],
    ["COORDINATOR", ["CONSULTANT"]],
    ["CONSULTANT", []],
    ["OFFSHORE_MANAGER", ["OFFSHORE_TEAM_LEAD"]],
    ["OFFSHORE_TEAM_LEAD", []],
    ["TRAINER", []],
    ["OTTER_TEAM", []],
  ])("creatableRoles(%s) === %j", (actorRole, expected) => {
    expect(creatableRoles(actorRole).sort()).toEqual([...expected].sort());
    for (const role of ALL_ROLES) {
      expect(canCreateRole(actorRole, role)).toBe(expected.includes(role));
    }
  });

  it("CEO cannot create OFFSHORE_TEAM_LEAD — only OFFSHORE_MANAGER can", () => {
    expect(canCreateRole("CEO", "OFFSHORE_TEAM_LEAD")).toBe(false);
    expect(canCreateRole("OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD")).toBe(true);
  });
});

describe("canManageUser", () => {
  it("always allows self-management regardless of role", () => {
    const actor = user("CONSULTANT", { id: "same-id" });
    expect(canManageUser(actor, target("CONSULTANT", { id: "same-id" }))).toBe(true);
  });

  it("CEO can manage anyone", () => {
    const actor = user("CEO", { id: "ceo-1" });
    expect(canManageUser(actor, target("LOCATION_MANAGER"))).toBe(true);
    expect(canManageUser(actor, target("CONSULTANT"))).toBe(true);
  });

  it("LOCATION_MANAGER can manage lower ranks in the same location only", () => {
    const actor = user("LOCATION_MANAGER", { id: "lm-1", locationId: "loc-a" });
    expect(canManageUser(actor, target("LOCATION_ADMIN", { locationId: "loc-a" }))).toBe(true);
    expect(canManageUser(actor, target("LOCATION_MANAGER", { locationId: "loc-a" }))).toBe(false); // rank tie
    expect(canManageUser(actor, target("LOCATION_ADMIN", { locationId: "loc-b" }))).toBe(false); // different location
    expect(canManageUser(actor, target("LOCATION_ADMIN", { locationId: null }))).toBe(false); // no location
  });

  it("LOCATION_ADMIN can manage lower ranks in the same location only", () => {
    const actor = user("LOCATION_ADMIN", { id: "la-1", locationId: "loc-a" });
    expect(canManageUser(actor, target("COORDINATOR", { locationId: "loc-a" }))).toBe(true);
    expect(canManageUser(actor, target("LOCATION_ADMIN", { locationId: "loc-a" }))).toBe(false); // rank tie
    expect(canManageUser(actor, target("COORDINATOR", { locationId: "loc-b" }))).toBe(false);
  });

  it("COORDINATOR can only manage their own consultants", () => {
    const actor = user("COORDINATOR", { id: "coord-1" });
    expect(canManageUser(actor, target("CONSULTANT", { coordinatorId: "coord-1" }))).toBe(true);
    expect(canManageUser(actor, target("CONSULTANT", { coordinatorId: "coord-2" }))).toBe(false);
    expect(canManageUser(actor, target("COORDINATOR", { coordinatorId: "coord-1" }))).toBe(false); // wrong target role
  });

  it("OFFSHORE_MANAGER can only manage Team Leads in the same office", () => {
    const actor = user("OFFSHORE_MANAGER", { id: "om-1", offshoreOffice: "LOCATION_1" });
    expect(canManageUser(actor, target("OFFSHORE_TEAM_LEAD", { offshoreOffice: "LOCATION_1" }))).toBe(true);
    expect(canManageUser(actor, target("OFFSHORE_TEAM_LEAD", { offshoreOffice: "LOCATION_2" }))).toBe(false);
    expect(canManageUser(actor, target("OFFSHORE_TEAM_LEAD", { offshoreOffice: null }))).toBe(false);
    expect(canManageUser(actor, target("CONSULTANT", { offshoreOffice: "LOCATION_1" }))).toBe(false); // wrong target role
  });

  it.each<Role>(["CONSULTANT", "OFFSHORE_TEAM_LEAD", "TRAINER", "OTTER_TEAM"])(
    "%s actors can never manage anyone but themselves",
    (role) => {
      const actor = user(role, { id: "actor-x" });
      expect(canManageUser(actor, target("CONSULTANT", { id: "someone-else" }))).toBe(false);
    }
  );
});

describe("canViewAsOffshoreManager", () => {
  it("true only for OFFSHORE_MANAGER viewing a CONSULTANT in the same office", () => {
    const actor = user("OFFSHORE_MANAGER", { offshoreOffice: "LOCATION_1" });
    expect(canViewAsOffshoreManager(actor, target("CONSULTANT", { offshoreOffice: "LOCATION_1" }))).toBe(true);
    expect(canViewAsOffshoreManager(actor, target("CONSULTANT", { offshoreOffice: "LOCATION_2" }))).toBe(false);
    expect(canViewAsOffshoreManager(actor, target("CONSULTANT", { offshoreOffice: null }))).toBe(false);
    expect(canViewAsOffshoreManager(actor, target("OFFSHORE_TEAM_LEAD", { offshoreOffice: "LOCATION_1" }))).toBe(false);
    expect(canViewAsOffshoreManager(user("CEO"), target("CONSULTANT", { offshoreOffice: "LOCATION_1" }))).toBe(false);
  });
});

describe("canManageTeamLead", () => {
  it("delegates to canManageUser but requires actor.role === OFFSHORE_MANAGER", () => {
    const office: OffshoreOffice = "LOCATION_1";
    const manager = user("OFFSHORE_MANAGER", { id: "om-1", offshoreOffice: office });
    const teamLead = target("OFFSHORE_TEAM_LEAD", { offshoreOffice: office });
    expect(canManageTeamLead(manager, teamLead)).toBe(true);

    // Same underlying scope would pass canManageUser for CEO too, but canManageTeamLead is OFFSHORE_MANAGER-only.
    expect(canManageTeamLead(user("CEO"), teamLead)).toBe(false);
  });
});

describe("canViewAsTeamLead / canViewAsTrainer / canViewAsOtterTeam", () => {
  it("canViewAsTeamLead requires matching offshoreTeamLeadId assignment", () => {
    const actor = user("OFFSHORE_TEAM_LEAD", { id: "tl-1" });
    expect(canViewAsTeamLead(actor, target("CONSULTANT", { offshoreTeamLeadId: "tl-1" }))).toBe(true);
    expect(canViewAsTeamLead(actor, target("CONSULTANT", { offshoreTeamLeadId: "tl-2" }))).toBe(false);
    expect(canViewAsTeamLead(actor, target("OFFSHORE_TEAM_LEAD", { offshoreTeamLeadId: "tl-1" }))).toBe(false);
    expect(canViewAsTeamLead(user("CEO", { id: "tl-1" }), target("CONSULTANT", { offshoreTeamLeadId: "tl-1" }))).toBe(false);
  });

  it("canViewAsTrainer requires matching trainerUserId assignment", () => {
    const actor = user("TRAINER", { id: "tr-1" });
    expect(canViewAsTrainer(actor, target("CONSULTANT", { trainerUserId: "tr-1" }))).toBe(true);
    expect(canViewAsTrainer(actor, target("CONSULTANT", { trainerUserId: "tr-2" }))).toBe(false);
    expect(canViewAsTrainer(actor, target("TRAINER", { trainerUserId: "tr-1" }))).toBe(false);
    expect(canViewAsTrainer(user("CEO", { id: "tr-1" }), target("CONSULTANT", { trainerUserId: "tr-1" }))).toBe(false);
  });

  it("canViewAsOtterTeam requires matching otterTeamUserId assignment", () => {
    const actor = user("OTTER_TEAM", { id: "ot-1" });
    expect(canViewAsOtterTeam(actor, target("CONSULTANT", { otterTeamUserId: "ot-1" }))).toBe(true);
    expect(canViewAsOtterTeam(actor, target("CONSULTANT", { otterTeamUserId: "ot-2" }))).toBe(false);
    expect(canViewAsOtterTeam(actor, target("OTTER_TEAM", { otterTeamUserId: "ot-1" }))).toBe(false);
    expect(canViewAsOtterTeam(user("CEO", { id: "ot-1" }), target("CONSULTANT", { otterTeamUserId: "ot-1" }))).toBe(false);
  });
});

describe("canAssignExtraCourses vs canAssignTrainingPath (asymmetry)", () => {
  it("both require a CONSULTANT target", () => {
    expect(canAssignExtraCourses(user("CEO"), target("COORDINATOR"))).toBe(false);
    expect(canAssignTrainingPath(user("CEO"), target("COORDINATOR"))).toBe(false);
  });

  it("canAssignExtraCourses excludes COORDINATOR actors; canAssignTrainingPath does not", () => {
    const coordinator = user("COORDINATOR", { id: "coord-1" });
    const consultant = target("CONSULTANT", { coordinatorId: "coord-1" });
    expect(canAssignExtraCourses(coordinator, consultant)).toBe(false);
    expect(canAssignTrainingPath(coordinator, consultant)).toBe(true);
  });

  it("both exclude CONSULTANT actors", () => {
    const actor = user("CONSULTANT", { id: "c-1" });
    const otherConsultant = target("CONSULTANT", { id: "c-2" });
    expect(canAssignExtraCourses(actor, otherConsultant)).toBe(false);
    expect(canAssignTrainingPath(actor, otherConsultant)).toBe(false);
  });

  it("delegate to canManageUser for other actor roles", () => {
    expect(canAssignExtraCourses(user("CEO"), target("CONSULTANT"))).toBe(true);
    expect(canAssignTrainingPath(user("CEO"), target("CONSULTANT"))).toBe(true);
  });
});

describe("flat role -> boolean gates", () => {
  it.each<Role>(["CEO", "LOCATION_MANAGER"])("canExportReports(%s) === true", (role) => {
    expect(canExportReports(role)).toBe(true);
  });
  it.each<Role>(["LOCATION_ADMIN", "COORDINATOR", "CONSULTANT", "OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD", "TRAINER", "OTTER_TEAM"])(
    "canExportReports(%s) === false",
    (role) => {
      expect(canExportReports(role)).toBe(false);
    }
  );

  it.each<Role>(["CEO", "LOCATION_MANAGER", "LOCATION_ADMIN"])("canBulkReassign(%s) === true", (role) => {
    expect(canBulkReassign(role)).toBe(true);
  });
  it.each<Role>(["COORDINATOR", "CONSULTANT", "OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD", "TRAINER", "OTTER_TEAM"])(
    "canBulkReassign(%s) === false",
    (role) => {
      expect(canBulkReassign(role)).toBe(false);
    }
  );

  it.each<Role>(["CEO", "LOCATION_MANAGER"])("canManageCatalogStructure(%s) === true", (role) => {
    expect(canManageCatalogStructure(role)).toBe(true);
  });
  it.each<Role>(["LOCATION_ADMIN", "COORDINATOR", "CONSULTANT", "OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD", "TRAINER", "OTTER_TEAM"])(
    "canManageCatalogStructure(%s) === false",
    (role) => {
      expect(canManageCatalogStructure(role)).toBe(false);
    }
  );

  it.each<Role>(["CEO", "LOCATION_MANAGER", "LOCATION_ADMIN"])("canManageVideos(%s) === true", (role) => {
    expect(canManageVideos(role)).toBe(true);
  });
  it.each<Role>(["COORDINATOR", "CONSULTANT", "OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD", "TRAINER", "OTTER_TEAM"])(
    "canManageVideos(%s) === false",
    (role) => {
      expect(canManageVideos(role)).toBe(false);
    }
  );

  it("isCeo is true only for CEO", () => {
    expect(isCeo("CEO")).toBe(true);
    for (const role of ALL_ROLES.filter((r) => r !== "CEO")) {
      expect(isCeo(role)).toBe(false);
    }
  });
});

describe("locationAssignmentModeFor", () => {
  it("CEO target never gets a location", () => {
    expect(locationAssignmentModeFor("LOCATION_MANAGER", "CEO")).toBe("none");
  });

  it.each<Role>(["TRAINER", "OTTER_TEAM", "OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD"])(
    "%s target never gets a location (uses offshoreOffice instead)",
    (targetRole) => {
      expect(locationAssignmentModeFor("CEO", targetRole)).toBe("none");
    }
  );

  it("LOCATION_MANAGER target is always required", () => {
    expect(locationAssignmentModeFor("CEO", "LOCATION_MANAGER")).toBe("required");
  });

  it("LOCATION_ADMIN target inherits from a LOCATION_MANAGER actor, else required", () => {
    expect(locationAssignmentModeFor("LOCATION_MANAGER", "LOCATION_ADMIN")).toBe("inherit");
    expect(locationAssignmentModeFor("CEO", "LOCATION_ADMIN")).toBe("required");
  });

  it("COORDINATOR target: optional for CEO, inherit for LOCATION_MANAGER/ADMIN, required otherwise", () => {
    expect(locationAssignmentModeFor("CEO", "COORDINATOR")).toBe("optional");
    expect(locationAssignmentModeFor("LOCATION_MANAGER", "COORDINATOR")).toBe("inherit");
    expect(locationAssignmentModeFor("LOCATION_ADMIN", "COORDINATOR")).toBe("inherit");
    expect(locationAssignmentModeFor("COORDINATOR", "COORDINATOR")).toBe("required");
  });

  it("CONSULTANT target falls through to none (handled separately in CreateUserForm)", () => {
    expect(locationAssignmentModeFor("CEO", "CONSULTANT")).toBe("none");
  });
});

describe("offshoreOfficeAssignmentModeFor", () => {
  it("OFFSHORE_MANAGER target is always required", () => {
    expect(offshoreOfficeAssignmentModeFor("CEO", "OFFSHORE_MANAGER")).toBe("required");
  });

  it("OFFSHORE_TEAM_LEAD target inherits from an OFFSHORE_MANAGER actor, else required", () => {
    expect(offshoreOfficeAssignmentModeFor("OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD")).toBe("inherit");
    expect(offshoreOfficeAssignmentModeFor("CEO", "OFFSHORE_TEAM_LEAD")).toBe("required");
  });

  it("any other target role is none", () => {
    expect(offshoreOfficeAssignmentModeFor("CEO", "CONSULTANT")).toBe("none");
    expect(offshoreOfficeAssignmentModeFor("CEO", "COORDINATOR")).toBe("none");
  });
});

describe("userVisibilityFilter", () => {
  it("CEO sees everyone (no filter)", () => {
    expect(userVisibilityFilter(user("CEO"))).toEqual({});
  });

  it("LOCATION_MANAGER is scoped to their location, excluding CEO/LOCATION_MANAGER roles", () => {
    const actor = user("LOCATION_MANAGER", { locationId: "loc-a" });
    expect(userVisibilityFilter(actor)).toEqual({
      locationId: "loc-a",
      role: { notIn: ["CEO", "LOCATION_MANAGER"] },
    });
  });

  it("LOCATION_MANAGER with no location sees nobody", () => {
    const actor = user("LOCATION_MANAGER", { locationId: null });
    expect(userVisibilityFilter(actor)).toEqual({ id: "__none__" });
  });

  it("LOCATION_ADMIN is scoped to their location, excluding CEO/LOCATION_MANAGER/LOCATION_ADMIN roles", () => {
    const actor = user("LOCATION_ADMIN", { locationId: "loc-a" });
    expect(userVisibilityFilter(actor)).toEqual({
      locationId: "loc-a",
      role: { notIn: ["CEO", "LOCATION_MANAGER", "LOCATION_ADMIN"] },
    });
  });

  it("LOCATION_ADMIN with no location sees nobody", () => {
    const actor = user("LOCATION_ADMIN", { locationId: null });
    expect(userVisibilityFilter(actor)).toEqual({ id: "__none__" });
  });

  it("COORDINATOR sees only their own consultants", () => {
    const actor = user("COORDINATOR", { id: "coord-1" });
    expect(userVisibilityFilter(actor)).toEqual({ coordinatorId: "coord-1", role: "CONSULTANT" });
  });

  it("CONSULTANT sees only themselves", () => {
    const actor = user("CONSULTANT", { id: "c-1" });
    expect(userVisibilityFilter(actor)).toEqual({ id: "c-1" });
  });

  it.each<Role>(["OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD", "TRAINER", "OTTER_TEAM"])(
    "%s falls through to the default (sees nobody via this filter)",
    (role) => {
      expect(userVisibilityFilter(user(role))).toEqual({ id: "__none__" });
    }
  );
});
