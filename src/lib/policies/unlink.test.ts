import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceRoleClientMock } = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { unlinkCustomerPolicy } from "@/lib/policies/unlink";

function linkLookup(data: { id: string } | null) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data, error: null });
  return query;
}

function claimLookup(statuses: string[]) {
  const query = { select: vi.fn(), eq: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockResolvedValue({
    data: statuses.map((status) => ({ status })),
    error: null,
  });
  return query;
}

function policyLookup(userId = "insurance-owner") {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { user_id: userId }, error: null });
  return query;
}

function linkDelete(data: { id: string } | null = { id: "link-id" }) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data, error: null });
  return query;
}

describe("unlinkCustomerPolicy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes only the authenticated customer's association", async () => {
    const authorization = linkLookup({ id: "link-id" });
    const claims = claimLookup(["CLOSED", "REJECTED"]);
    const deletion = linkDelete();
    const from = vi
      .fn()
      .mockReturnValueOnce(authorization)
      .mockReturnValueOnce(policyLookup())
      .mockReturnValueOnce(claims)
      .mockReturnValueOnce(deletion);
    createServiceRoleClientMock.mockReturnValue({ from });

    await expect(
      unlinkCustomerPolicy({ portalUserId: "portal-user", policyId: "policy-id" }),
    ).resolves.toEqual({ ok: true });

    expect(authorization.eq).toHaveBeenNthCalledWith(1, "portal_user_id", "portal-user");
    expect(authorization.eq).toHaveBeenNthCalledWith(2, "policy_id", "policy-id");
    expect(deletion.eq).toHaveBeenCalledWith("id", "link-id");
    expect(deletion.eq).toHaveBeenCalledWith("portal_user_id", "portal-user");
    expect(deletion.eq).toHaveBeenCalledWith("policy_id", "policy-id");
    expect(from).toHaveBeenCalledWith("policies");
    expect(from).not.toHaveBeenCalledWith("vehicles");
  });

  it("does not remove a directly owned policy even if a stale link also exists", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(linkLookup({ id: "link-id" }))
      .mockReturnValueOnce(policyLookup("portal-user"));
    createServiceRoleClientMock.mockReturnValue({ from });

    await expect(
      unlinkCustomerPolicy({ portalUserId: "portal-user", policyId: "policy-id" }),
    ).resolves.toEqual({ ok: false, reason: "not_linked" });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("blocks an unauthorized or already-removed link", async () => {
    const from = vi.fn().mockReturnValueOnce(linkLookup(null));
    createServiceRoleClientMock.mockReturnValue({ from });

    await expect(
      unlinkCustomerPolicy({ portalUserId: "other-user", policyId: "policy-id" }),
    ).resolves.toEqual({ ok: false, reason: "not_linked" });
    expect(from).toHaveBeenCalledOnce();
  });

  it.each([
    "SUBMITTED",
    "UNDER_REVIEW",
    "MORE_INFO_REQUIRED",
    "APPROVED",
    "UNKNOWN_STATUS",
  ])(
    "blocks unlinking for an active %s claim",
    async (status) => {
      const from = vi
        .fn()
        .mockReturnValueOnce(linkLookup({ id: "link-id" }))
        .mockReturnValueOnce(policyLookup())
        .mockReturnValueOnce(claimLookup([status]));
      createServiceRoleClientMock.mockReturnValue({ from });

      await expect(
        unlinkCustomerPolicy({ portalUserId: "portal-user", policyId: "policy-id" }),
      ).resolves.toEqual({ ok: false, reason: "active_claim" });
      expect(from).toHaveBeenCalledTimes(3);
    },
  );

  it.each(["REJECTED", "CLOSED"])(
    "allows unlinking when the only claim is final: %s",
    async (status) => {
      const from = vi
        .fn()
        .mockReturnValueOnce(linkLookup({ id: "link-id" }))
        .mockReturnValueOnce(policyLookup())
        .mockReturnValueOnce(claimLookup([status]))
        .mockReturnValueOnce(linkDelete());
      createServiceRoleClientMock.mockReturnValue({ from });

      await expect(
        unlinkCustomerPolicy({ portalUserId: "portal-user", policyId: "policy-id" }),
      ).resolves.toEqual({ ok: true });
    },
  );
});
