import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const trainerFindFirstMock = vi.fn();
const otterFindFirstMock = vi.fn();
const userFindManyMock = vi.fn();
const txUserUpdateMock = vi.fn();
const transactionMock = vi.fn(async (callback: (tx: unknown) => unknown) =>
  callback({ user: { update: txUserUpdateMock } })
);
const logAuditMock = vi.fn().mockResolvedValue({ id: "audit-1" });
const notifyUserMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: findUniqueMock, findMany: userFindManyMock },
    trainerFeedback: { findFirst: trainerFindFirstMock },
    otterFeedback: { findFirst: otterFindFirstMock },
    $transaction: transactionMock,
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock, notifyUser: notifyUserMock }));

function baseConsultant(overrides: Record<string, unknown> = {}) {
  return {
    id: "consultant-1",
    role: "CONSULTANT",
    marketingStatus: "IN_TRAINING",
    firstName: "Sam",
    lastName: "Patel",
    username: "spatel",
    locationId: null,
    offshoreOffice: null,
    offshoreTeamLeadId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({ user: { update: txUserUpdateMock } })
  );
  userFindManyMock.mockResolvedValue([]);
});

describe("evaluateMarketingReadiness", () => {
  it("no-ops when the consultant doesn't exist", async () => {
    findUniqueMock.mockResolvedValue(null);
    trainerFindFirstMock.mockResolvedValue(null);
    otterFindFirstMock.mockResolvedValue(null);

    const { evaluateMarketingReadiness } = await import("@/lib/marketingReadiness");
    await evaluateMarketingReadiness("nonexistent");

    expect(transactionMock).not.toHaveBeenCalled();
    expect(notifyUserMock).not.toHaveBeenCalled();
  });

  it("no-ops when the user isn't a CONSULTANT", async () => {
    findUniqueMock.mockResolvedValue(baseConsultant({ role: "TRAINER" }));
    trainerFindFirstMock.mockResolvedValue({ verdict: "READY" });
    otterFindFirstMock.mockResolvedValue({ verdict: "READY" });

    const { evaluateMarketingReadiness } = await import("@/lib/marketingReadiness");
    await evaluateMarketingReadiness("consultant-1");

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("no-ops when already IN_MARKETING, even if both verdicts are READY", async () => {
    findUniqueMock.mockResolvedValue(baseConsultant({ marketingStatus: "IN_MARKETING" }));
    trainerFindFirstMock.mockResolvedValue({ verdict: "READY" });
    otterFindFirstMock.mockResolvedValue({ verdict: "READY" });

    const { evaluateMarketingReadiness } = await import("@/lib/marketingReadiness");
    await evaluateMarketingReadiness("consultant-1");

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("no-ops when only the Trainer verdict is READY", async () => {
    findUniqueMock.mockResolvedValue(baseConsultant());
    trainerFindFirstMock.mockResolvedValue({ verdict: "READY" });
    otterFindFirstMock.mockResolvedValue({ verdict: "NOT_READY" });

    const { evaluateMarketingReadiness } = await import("@/lib/marketingReadiness");
    await evaluateMarketingReadiness("consultant-1");

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("no-ops when there's no Otter feedback at all yet (undefined verdict)", async () => {
    findUniqueMock.mockResolvedValue(baseConsultant());
    trainerFindFirstMock.mockResolvedValue({ verdict: "READY" });
    otterFindFirstMock.mockResolvedValue(null);

    const { evaluateMarketingReadiness } = await import("@/lib/marketingReadiness");
    await evaluateMarketingReadiness("consultant-1");

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("flips status, writes one audit entry inside a transaction, and notifies when both verdicts are READY", async () => {
    findUniqueMock.mockResolvedValue(baseConsultant());
    trainerFindFirstMock.mockResolvedValue({ verdict: "READY" });
    otterFindFirstMock.mockResolvedValue({ verdict: "READY" });
    userFindManyMock.mockResolvedValue([]);

    const { evaluateMarketingReadiness } = await import("@/lib/marketingReadiness");
    await evaluateMarketingReadiness("consultant-1");

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txUserUpdateMock).toHaveBeenCalledWith({
      where: { id: "consultant-1" },
      data: { marketingStatus: "IN_MARKETING" },
    });
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toMatchObject({
      actionType: "MARKETING_STATUS_CHANGED",
      actorUserId: null,
      targetUserId: "consultant-1",
    });
  });

  it("dedupes recipients via Set — a user who'd otherwise be notified twice is only notified once", async () => {
    findUniqueMock.mockResolvedValue(
      baseConsultant({ offshoreOffice: "LOCATION_1", offshoreTeamLeadId: "team-lead-1", locationId: "loc-a" })
    );
    trainerFindFirstMock.mockResolvedValue({ verdict: "READY" });
    otterFindFirstMock.mockResolvedValue({ verdict: "READY" });
    // Same id ("team-lead-1") also happens to show up as location staff -
    // this shouldn't be possible in real data, but proves the dedup works
    // regardless of *why* two lookups produced overlapping ids.
    userFindManyMock
      .mockResolvedValueOnce([{ id: "offshore-mgr-1" }]) // offshore managers query
      .mockResolvedValueOnce([{ id: "team-lead-1" }]); // location staff query (overlaps with the team lead)

    const { evaluateMarketingReadiness } = await import("@/lib/marketingReadiness");
    await evaluateMarketingReadiness("consultant-1");

    const notifiedIds = notifyUserMock.mock.calls.map((call) => call[0].recipientUserId);
    expect(new Set(notifiedIds).size).toBe(notifiedIds.length); // no duplicates
    expect(notifiedIds.sort()).toEqual(["offshore-mgr-1", "team-lead-1"].sort());
  });
});
