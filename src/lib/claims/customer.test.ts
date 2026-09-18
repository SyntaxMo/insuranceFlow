import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceRoleClientMock } = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import {
  summarizeCustomerAccount,
  getEligibleCustomerClaimPolicies,
  getCustomerDashboard,
  getCustomerClaimDetails,
  getCustomerPolicyDetails,
} from "@/lib/claims/customer";

describe("summarizeCustomerAccount", () => {
  it("deduplicates policy access and uses the dashboard's existing open-claim semantics", () => {
    const direct = { ...policy("policy-1", "POL-1", "Toyota"), accessType: "DIRECT" as const };
    const duplicateLink = { ...direct, accessType: "LINKED" as const };
    const inactive = {
      ...policy("policy-2", "POL-2", "Nissan"),
      status: "INACTIVE",
      accessType: "DIRECT" as const,
    };
    const claimBase = {
      policy_id: "policy-1",
      accident_date: "2026-09-01",
      created_at: "2026-09-02T10:00:00Z",
      vehicle: null,
    };
    const claims = [
      { ...claimBase, id: "claim-1", claim_number: "CLM-1", status: "UNDER_REVIEW" },
      { ...claimBase, id: "claim-1", claim_number: "CLM-1", status: "UNDER_REVIEW" },
      { ...claimBase, id: "claim-2", claim_number: "CLM-2", status: "APPROVED" },
      { ...claimBase, id: "claim-3", claim_number: "CLM-3", status: "REJECTED" },
      { ...claimBase, id: "claim-4", claim_number: "CLM-4", status: "CLOSED" },
    ];

    expect(summarizeCustomerAccount([direct, duplicateLink, inactive], claims)).toEqual({
      activePolicies: 1,
      openClaims: 2,
      totalClaims: 4,
    });
  });
});

function policy(id: string, number: string, make: string) {
  return {
    id,
    policy_number: number,
    status: "ACTIVE",
    coverage_type: "Comprehensive",
    start_date: "2020-01-01",
    end_date: "2099-12-31",
    excess_amount: 250,
    coverage_limit: 20000,
    vehicles: {
      id: `${id}-vehicle`,
      make,
      model: "Model",
      year: 2024,
      plate_number: `${id}-PLATE`,
    },
  };
}

function eqResult(result: unknown) {
  const query = { select: vi.fn(), eq: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockResolvedValue(result);
  return query;
}

function orderedEqResult(result: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  return query;
}

function orderedInResult(result: unknown) {
  const query = { select: vi.fn(), in: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  return query;
}

function singleEqResult(result: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

describe("getCustomerDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("merges direct and verified linked policies, deduplicates them, and scopes claims", async () => {
    const links = eqResult({
      data: [{ policy_id: "policy-1" }, { policy_id: "policy-2" }],
      error: null,
    });
    const direct = orderedEqResult({
      data: [policy("policy-1", "POL-1", "Toyota")],
      error: null,
    });
    const linked = orderedInResult({
      data: [
        policy("policy-1", "POL-1", "Toyota"),
        policy("policy-2", "POL-2", "Nissan"),
      ],
      error: null,
    });
    const claims = orderedInResult({
      data: [
        {
          id: "claim-2",
          policy_id: "policy-2",
          claim_number: "CLM-2",
          status: "UNDER_REVIEW",
          accident_date: "2026-03-10",
          created_at: "2026-03-11T10:00:00Z",
        },
      ],
      error: null,
    });

    const from = vi
      .fn()
      .mockReturnValueOnce(links)
      .mockReturnValueOnce(direct)
      .mockReturnValueOnce(linked)
      .mockReturnValueOnce(claims);
    createServiceRoleClientMock.mockReturnValue({ from });

    const result = await getCustomerDashboard("portal-user-id");

    expect(links.eq).toHaveBeenCalledWith("portal_user_id", "portal-user-id");
    expect(direct.eq).toHaveBeenCalledWith("user_id", "portal-user-id");
    expect(linked.in).toHaveBeenCalledWith("id", ["policy-1", "policy-2"]);
    expect(claims.in).toHaveBeenCalledWith("policy_id", ["policy-1", "policy-2"]);
    expect(result.policies.map((item) => item.id)).toEqual(["policy-1", "policy-2"]);
    expect(result.policies.map((item) => item.accessType)).toEqual(["DIRECT", "LINKED"]);
    expect(result.claims[0]?.vehicle?.make).toBe("Nissan");
  });

  it("does not query claims when the customer has no direct or linked policies", async () => {
    const links = eqResult({ data: [], error: null });
    const direct = orderedEqResult({ data: [], error: null });
    const from = vi.fn().mockReturnValueOnce(links).mockReturnValueOnce(direct);
    createServiceRoleClientMock.mockReturnValue({ from });

    const result = await getCustomerDashboard("portal-user-id");

    expect(from).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ policies: [], claims: [], error: null });
  });
});

describe("getEligibleCustomerClaimPolicies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("combines direct and linked active policies and removes duplicate access paths", async () => {
    const links = eqResult({
      data: [{ policy_id: "policy-1" }, { policy_id: "policy-2" }],
      error: null,
    });
    const direct = orderedEqResult({
      data: [policy("policy-1", "POL-1", "Toyota")],
      error: null,
    });
    const linked = orderedInResult({
      data: [
        policy("policy-1", "POL-1", "Toyota"),
        policy("policy-2", "POL-2", "Nissan"),
      ],
      error: null,
    });
    createServiceRoleClientMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(links).mockReturnValueOnce(direct).mockReturnValueOnce(linked),
    });

    const result = await getEligibleCustomerClaimPolicies("portal-user-id");

    expect(result.error).toBeNull();
    expect(result.policies.map((item) => item.policyId)).toEqual(["policy-1", "policy-2"]);
    expect(result.policies.map((item) => item.accessType)).toEqual(["DIRECT", "LINKED"]);
  });

  it("uses the existing eligibility rules to omit inactive policies", async () => {
    const links = eqResult({ data: [], error: null });
    const direct = orderedEqResult({
      data: [{ ...policy("policy-1", "POL-1", "Toyota"), status: "INACTIVE" }],
      error: null,
    });
    createServiceRoleClientMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(links).mockReturnValueOnce(direct),
    });

    const result = await getEligibleCustomerClaimPolicies("portal-user-id");

    expect(result).toEqual({ policies: [], error: null });
  });
});

describe("getCustomerClaimDetails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns customer-safe request and decision history for an owned claim", async () => {
    const claimQuery = singleEqResult({ data: {
      id: "claim-1", policy_id: "policy-1", claim_number: "CLM-1",
      status: "MORE_INFO_REQUIRED", accident_date: "2026-09-10",
      accident_location: "Manama", description: "Rear collision details",
      created_at: "2026-09-11T10:00:00Z", updated_at: "2026-09-11T11:00:00Z",
    }, error: null });
    const policyQuery = singleEqResult({ data: {
      ...policy("policy-1", "POL-1", "Toyota"),
      user_id: "portal-user",
    }, error: null });
    const historyQuery = orderedEqResult({ data: [
      { id: "h0", claim_id: "claim-1", from_status: "UNDER_REVIEW", to_status: "SUBMITTED", action: "REVIEW_RETURNED", note: null, actor_user_id: "officer", actor_role: "CLAIMS_OFFICER", created_at: "2026-09-11T10:30:00Z" },
      { id: "h1", claim_id: "claim-1", from_status: "UNDER_REVIEW", to_status: "MORE_INFO_REQUIRED", action: "MORE_INFO_REQUESTED", note: "Please upload the police report.", actor_user_id: "officer", actor_role: "CLAIMS_OFFICER", created_at: "2026-09-11T11:00:00Z" },
      { id: "h2", claim_id: "claim-1", from_status: "UNDER_REVIEW", to_status: "APPROVED", action: "CLAIM_APPROVED", note: "Internal approval note", actor_user_id: "officer", actor_role: "CLAIMS_OFFICER", created_at: "2026-09-11T12:00:00Z" },
    ], error: null });
    createServiceRoleClientMock.mockReturnValue({ from: vi.fn()
      .mockReturnValueOnce(claimQuery)
      .mockReturnValueOnce(policyQuery)
      .mockReturnValueOnce(historyQuery) });

    const result = await getCustomerClaimDetails("portal-user", "claim-1");
    expect(result.claim?.latestInformationRequest).toBe("Please upload the police report.");
    expect(result.claim?.history.map((event) => event.action)).toContain("REVIEW_RETURNED");
    expect(result.claim?.history[0]?.actor_user_id).toBeNull();
    expect(result.claim?.history[2]?.note).toBeNull();
  });

  it("does not expose another customer's claim", async () => {
    const claimQuery = singleEqResult({ data: { id: "claim-1", policy_id: "policy-1" }, error: null });
    const policyQuery = singleEqResult({ data: { ...policy("policy-1", "POL-1", "Toyota"), user_id: "owner" }, error: null });
    const linkQuery = singleEqResult({ data: null, error: null });
    createServiceRoleClientMock.mockReturnValue({ from: vi.fn()
      .mockReturnValueOnce(claimQuery)
      .mockReturnValueOnce(policyQuery)
      .mockReturnValueOnce(linkQuery) });
    await expect(getCustomerClaimDetails("other-user", "claim-1")).resolves.toEqual({ claim: null, error: null });
  });
});

describe("getCustomerPolicyDetails", () => {
  beforeEach(() => vi.clearAllMocks());

  const detailPolicy = {
    ...policy("policy-1", "POL-1", "Toyota"),
    user_id: "insurance-owner",
    vehicles: {
      make: "Toyota",
      model: "RAV4",
      year: 2023,
      plate_number: "45821",
      vin: "REAL-VIN-123",
    },
  };

  it("authorizes and identifies a directly owned policy", async () => {
    const direct = { ...detailPolicy, user_id: "portal-user" };
    const from = vi.fn().mockReturnValueOnce(
      singleEqResult({ data: direct, error: null }),
    );
    createServiceRoleClientMock.mockReturnValue({ from });

    const result = await getCustomerPolicyDetails("portal-user", "policy-1");

    expect(result.policy?.accessType).toBe("DIRECT");
    const vehicle = Array.isArray(result.policy?.vehicles)
      ? result.policy?.vehicles[0]
      : result.policy?.vehicles;
    expect(vehicle?.vin).toBe("REAL-VIN-123");
    expect(from).toHaveBeenCalledOnce();
  });

  it("authorizes and identifies a linked policy", async () => {
    const policyQuery = singleEqResult({ data: detailPolicy, error: null });
    const linkQuery = singleEqResult({ data: { id: "link-id" }, error: null });
    createServiceRoleClientMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(policyQuery).mockReturnValueOnce(linkQuery),
    });

    const result = await getCustomerPolicyDetails("portal-user", "policy-1");

    expect(linkQuery.eq).toHaveBeenCalledWith("portal_user_id", "portal-user");
    expect(linkQuery.eq).toHaveBeenCalledWith("policy_id", "policy-1");
    expect(result.policy?.accessType).toBe("LINKED");
  });

  it("returns no policy when the URL customer has no direct or linked access", async () => {
    createServiceRoleClientMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(singleEqResult({ data: detailPolicy, error: null }))
        .mockReturnValueOnce(singleEqResult({ data: null, error: null })),
    });

    const result = await getCustomerPolicyDetails("other-user", "policy-1");

    expect(result).toEqual({ policy: null, error: null });
  });
});
