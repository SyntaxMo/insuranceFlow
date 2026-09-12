import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceRoleClientMock } = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import {
  findExistingPolicyMatch,
  maskEmail,
  maskPolicyNumber,
  normalizeEmail,
  normalizePolicyNumber,
} from "@/lib/policies/link-existing";

function mockPolicyQuery(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const ilike = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ ilike });
  const from = vi.fn().mockReturnValue({ select });
  createServiceRoleClientMock.mockReturnValue({ from });
  return { from, select, ilike, maybeSingle };
}

describe("existing policy lookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes lookup values and masks returned identifiers", () => {
    expect(normalizePolicyNumber("  pol-2026-0101 ")).toBe("POL-2026-0101");
    expect(normalizeEmail("  Member@Example.COM ")).toBe("member@example.com");
    expect(maskPolicyNumber("POL-2026-0101")).toBe("••••0101");
    expect(maskEmail("member@example.com")).toBe("m••••r@example.com");
  });

  it("returns only a masked match after a case-insensitive email comparison", async () => {
    const query = mockPolicyQuery({
      id: "policy-id",
      policy_number: "POL-2026-0101",
      status: "ACTIVE",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      coverage_type: "Comprehensive",
      policyholder: { email: "Member@Example.com" },
      vehicle: { make: "Toyota", model: "RAV4", year: 2023 },
    });

    const result = await findExistingPolicyMatch(
      " pol-2026-0101 ",
      " member@example.COM ",
    );

    expect(query.from).toHaveBeenCalledWith("policies");
    expect(query.ilike).toHaveBeenCalledWith(
      "policy_number",
      "POL-2026-0101",
    );
    expect(result).toEqual({
      maskedPolicyNumber: "••••0101",
      vehicle: { make: "Toyota", model: "RAV4", year: 2023 },
      coverageType: "Comprehensive",
      status: "ACTIVE",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      maskedEmail: "m••••r@example.com",
      isExpired: false,
    });
    expect(result).not.toHaveProperty("policyholder");
  });

  it("returns no match for a wrong email or unresolved policyholder", async () => {
    mockPolicyQuery({
      id: "policy-id",
      policy_number: "POL-2026-0101",
      status: "EXPIRED",
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      coverage_type: "Comprehensive",
      policyholder: { email: "member@example.com" },
      vehicle: { make: "Toyota", model: "RAV4", year: 2023 },
    });

    await expect(
      findExistingPolicyMatch("POL-2026-0101", "wrong@example.com"),
    ).resolves.toBeNull();
  });

  it("returns an expired match without presenting it as active", async () => {
    mockPolicyQuery({
      id: "policy-id",
      policy_number: "POL-2025-0101",
      status: "EXPIRED",
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      coverage_type: "Comprehensive",
      policyholder: { email: "member@example.com" },
      vehicle: { make: "Toyota", model: "RAV4", year: 2023 },
    });

    const result = await findExistingPolicyMatch(
      "POL-2025-0101",
      "member@example.com",
    );

    expect(result?.status).toBe("EXPIRED");
    expect(result?.isExpired).toBe(true);
  });
});
