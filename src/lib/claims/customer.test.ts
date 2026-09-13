import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceRoleClientMock } = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import {
  getCustomerDashboard,
  getCustomerPolicyDetails,
} from "@/lib/claims/customer";

function policy(id: string, number: string, make: string) {
  return {
    id,
    policy_number: number,
    status: "ACTIVE",
    coverage_type: "Comprehensive",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    excess_amount: 250,
    coverage_limit: 20000,
    vehicles: {
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
