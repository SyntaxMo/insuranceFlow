// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyPolicyById: vi.fn(),
  createUniqueClaimNumber: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getStorageBucket: vi.fn(() => "claim-documents"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/claims/policy", () => ({ verifyPolicyById: mocks.verifyPolicyById }));
vi.mock("@/lib/claims/numbers", () => ({ createUniqueClaimNumber: mocks.createUniqueClaimNumber }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
  getStorageBucket: mocks.getStorageBucket,
}));

import { submitClaim } from "@/lib/claims/submit";

const policyId = "11111111-1111-4111-8111-111111111111";
const customer = {
  id: "customer-profile-id",
  auth_user_id: "auth-user-id",
  full_name: "Demo Customer",
  email: "customer@example.com",
  phone: "+973 3900 0000",
  role: "CUSTOMER" as const,
};

function validFile(name: string, type: string, contents: string): File {
  const file = new File([contents], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode(contents).buffer,
  });
  return file;
}

function validFormData() {
  const formData = new FormData();
  formData.set("policyId", policyId);
  formData.set("accidentDate", "2026-09-01");
  formData.set("accidentLocation", "Manama Highway");
  formData.set("description", "The vehicle was struck from behind.");
  formData.set("repairEstimate", validFile("repair.pdf", "application/pdf", "repair"));
  formData.append("accidentPhotos", validFile("accident.jpg", "image/jpeg", "photo"));
  return formData;
}

describe("submitClaim selected policy flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUniqueClaimNumber.mockResolvedValue("CLM-2026-ABC123");
    mocks.verifyPolicyById.mockResolvedValue({
      ok: true,
      policy: {
        policyId,
        policyNumber: "MOT-2026-ABC123",
        coverageType: "COMPREHENSIVE",
        excessAmount: 150,
        coverageLimit: 9_500,
        startDate: "2026-01-01",
        endDate: "2027-01-01",
        vehicle: {
          id: "vehicle-id",
          make: "Toyota",
          model: "Corolla",
          year: 2026,
          plateNumber: "927410",
        },
      },
    });
  });

  it("revalidates the selected policy ID and keeps the atomic claim/history and document pipeline", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({
      data: [{ claim_id: "claim-id", claim_number: "CLM-2026-ABC123" }],
      error: null,
    });
    mocks.createServiceRoleClient.mockReturnValue({
      rpc,
      storage: { from: vi.fn(() => ({ upload, remove: vi.fn() })) },
      from: vi.fn(() => ({ insert, delete: vi.fn() })),
    });

    const result = await submitClaim(validFormData(), customer);

    expect(mocks.verifyPolicyById).toHaveBeenCalledWith(policyId, customer.id);
    expect(rpc).toHaveBeenCalledWith(
      "create_claim_with_history",
      expect.objectContaining({
        p_policy_id: policyId,
        p_actor_user_id: customer.id,
      }),
    );
    expect(upload).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, claimNumber: "CLM-2026-ABC123" });
  });

  it("stops before claim creation when server-side policy authorization fails", async () => {
    mocks.verifyPolicyById.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      error: "This policy is not available for your account.",
    });

    const result = await submitClaim(validFormData(), customer);

    expect(result).toEqual({
      ok: false,
      error: "This policy is not available for your account.",
    });
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
  });
});
