import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceRoleClientMock } = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { verifyPolicyByNumber } from "@/lib/claims/policy";

const activePolicy = {
  id: "policy-id",
  user_id: "seeded-insurance-user",
  vehicle_id: "vehicle-id",
  policy_number: "POL-1",
  status: "ACTIVE",
  start_date: "2020-01-01",
  end_date: "2099-12-31",
  coverage_type: "Comprehensive",
  excess_amount: 250,
  coverage_limit: 20000,
  vehicles: {
    id: "vehicle-id",
    owner_id: "seeded-insurance-user",
    make: "Toyota",
    model: "Camry",
    year: 2024,
      plate_number: "123456",
  },
};

function policyQuery(data: typeof activePolicy | null) {
  const query = { select: vi.fn(), ilike: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data, error: null });
  return query;
}

function linkQuery(data: { id: string } | null) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data, error: null });
  return query;
}

describe("verifyPolicyByNumber customer access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a policy associated through customer_policy_links", async () => {
    const policy = policyQuery(activePolicy);
    const link = linkQuery({ id: "link-id" });
    createServiceRoleClientMock.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(policy).mockReturnValueOnce(link),
    });

    const result = await verifyPolicyByNumber("pol-1", "portal-user-id");

    expect(link.eq).toHaveBeenNthCalledWith(1, "portal_user_id", "portal-user-id");
    expect(link.eq).toHaveBeenNthCalledWith(2, "policy_id", "policy-id");
    expect(result.ok).toBe(true);
  });

  it("rejects a policy with neither direct ownership nor a verified link", async () => {
    createServiceRoleClientMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(policyQuery(activePolicy))
        .mockReturnValueOnce(linkQuery(null)),
    });

    const result = await verifyPolicyByNumber("POL-1", "other-portal-user");

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("keeps direct-owner policies working without requiring a link", async () => {
    const directPolicy = { ...activePolicy, user_id: "portal-user-id" };
    const from = vi.fn().mockReturnValueOnce(policyQuery(directPolicy));
    createServiceRoleClientMock.mockReturnValue({ from });

    const result = await verifyPolicyByNumber("POL-1", "portal-user-id");

    expect(result.ok).toBe(true);
    expect(from).toHaveBeenCalledOnce();
  });
});
