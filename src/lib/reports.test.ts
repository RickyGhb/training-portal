import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

function actor(role: SessionUser["role"], overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "actor-1",
    role,
    status: "ACTIVE",
    firstName: "Test",
    lastName: "Actor",
    username: "test.actor",
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

describe("consultantScopeFilter", () => {
  it("CEO has no scope restriction", async () => {
    const { consultantScopeFilter } = await import("@/lib/reports");
    expect(consultantScopeFilter(actor("CEO"))).toEqual({});
  });

  it("LOCATION_MANAGER/LOCATION_ADMIN scope to their own locationId", async () => {
    const { consultantScopeFilter } = await import("@/lib/reports");
    expect(consultantScopeFilter(actor("LOCATION_MANAGER", { locationId: "loc-a" }))).toEqual({ locationId: "loc-a" });
    expect(consultantScopeFilter(actor("LOCATION_ADMIN", { locationId: "loc-b" }))).toEqual({ locationId: "loc-b" });
  });

  it("LOCATION_MANAGER/LOCATION_ADMIN with no location see nobody", async () => {
    const { consultantScopeFilter } = await import("@/lib/reports");
    expect(consultantScopeFilter(actor("LOCATION_MANAGER", { locationId: null }))).toEqual({ id: "__none__" });
    expect(consultantScopeFilter(actor("LOCATION_ADMIN", { locationId: null }))).toEqual({ id: "__none__" });
  });

  it("COORDINATOR scopes to their own consultants", async () => {
    const { consultantScopeFilter } = await import("@/lib/reports");
    expect(consultantScopeFilter(actor("COORDINATOR", { id: "coord-1" }))).toEqual({ coordinatorId: "coord-1" });
  });

  it("every other role sees nobody via this filter", async () => {
    const { consultantScopeFilter } = await import("@/lib/reports");
    for (const role of ["CONSULTANT", "OFFSHORE_MANAGER", "OFFSHORE_TEAM_LEAD", "TRAINER", "OTTER_TEAM"] as const) {
      expect(consultantScopeFilter(actor(role))).toEqual({ id: "__none__" });
    }
  });
});

describe("getConsultantReportRows where-clause construction", () => {
  const findManyMock = vi.fn().mockResolvedValue([]);

  beforeEach(() => {
    vi.resetModules();
    findManyMock.mockClear();
    findManyMock.mockResolvedValue([]);
  });

  it("AND-combines scope and filters so a filter can only narrow, never widen scope", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: { user: { findMany: findManyMock } } }));
    vi.doMock("@/lib/content-resolution", () => ({ getConsultantProgress: vi.fn() }));

    const { getConsultantReportRows } = await import("@/lib/reports");
    const coordinator = actor("COORDINATOR", { id: "coord-1" });

    // A Coordinator passing a coordinatorId filter for someone else must NOT
    // widen their scope - the AND-combination means this yields zero rows,
    // not "someone else's consultants".
    await getConsultantReportRows(coordinator, { coordinatorId: "someone-elses-id" });

    const callArgs = findManyMock.mock.calls[0][0];
    expect(callArgs.where.AND).toContainEqual({ coordinatorId: "coord-1" }); // scope, unmodified
    expect(callArgs.where.AND).toContainEqual({ coordinatorId: "someone-elses-id" }); // filter, separate AND branch
  });

  it("DELETED status filter switches to deletedAt: not null instead of the status field", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: { user: { findMany: findManyMock } } }));
    vi.doMock("@/lib/content-resolution", () => ({ getConsultantProgress: vi.fn() }));

    const { getConsultantReportRows } = await import("@/lib/reports");
    await getConsultantReportRows(actor("CEO"), { status: "DELETED" });

    const callArgs = findManyMock.mock.calls[0][0];
    expect(callArgs.where.deletedAt).toEqual({ not: null });
  });

  it("a non-DELETED status filter keeps deletedAt: null and adds a status branch", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: { user: { findMany: findManyMock } } }));
    vi.doMock("@/lib/content-resolution", () => ({ getConsultantProgress: vi.fn() }));

    const { getConsultantReportRows } = await import("@/lib/reports");
    await getConsultantReportRows(actor("CEO"), { status: "ACTIVE" });

    const callArgs = findManyMock.mock.calls[0][0];
    expect(callArgs.where.deletedAt).toBeNull();
    expect(callArgs.where.AND).toContainEqual({ status: "ACTIVE" });
  });
});
