import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceRoleClientMock } = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { getCustomerDashboard } from "@/lib/claims/customer";

describe("getCustomerDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes policies to the resolved customer and claims to owned policies", async () => {
    const policyOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "policy-1",
          policy_number: "POL-1",
          status: "ACTIVE",
          coverage_type: "Comprehensive",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          excess_amount: 250,
          coverage_limit: 20000,
          vehicles: {
            make: "Toyota",
            model: "Camry",
            year: 2024,
            plate_number: "ABC123",
          },
        },
      ],
      error: null,
    });
    const policyEq = vi.fn().mockReturnValue({ order: policyOrder });
    const policySelect = vi.fn().mockReturnValue({ eq: policyEq });

    const claimOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "claim-1",
          policy_id: "policy-1",
          claim_number: "CLM-1",
          status: "UNDER_REVIEW",
          accident_date: "2026-03-10",
          created_at: "2026-03-11T10:00:00Z",
        },
      ],
      error: null,
    });
    const claimIn = vi.fn().mockReturnValue({ order: claimOrder });
    const claimSelect = vi.fn().mockReturnValue({ in: claimIn });

    const from = vi
      .fn()
      .mockReturnValueOnce({ select: policySelect })
      .mockReturnValueOnce({ select: claimSelect });
    createServiceRoleClientMock.mockReturnValue({ from });

    const result = await getCustomerDashboard("customer-profile-id");

    expect(policyEq).toHaveBeenCalledWith("user_id", "customer-profile-id");
    expect(claimIn).toHaveBeenCalledWith("policy_id", ["policy-1"]);
    expect(result.claims[0]?.vehicle).toEqual({
      make: "Toyota",
      model: "Camry",
      year: 2024,
      plate_number: "ABC123",
    });
  });

  it("does not query claims when the customer owns no policies", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createServiceRoleClientMock.mockReturnValue({ from });

    const result = await getCustomerDashboard("customer-profile-id");

    expect(from).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ policies: [], claims: [], error: null });
  });
});
