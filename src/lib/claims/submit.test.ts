// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyPolicyById: vi.fn(),
  createUniqueClaimNumber: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getStorageBucket: vi.fn(() => "claim-documents"),
  sendClaimSubmissionEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/claims/policy", () => ({ verifyPolicyById: mocks.verifyPolicyById }));
vi.mock("@/lib/claims/numbers", () => ({ createUniqueClaimNumber: mocks.createUniqueClaimNumber }));
vi.mock("@/lib/claims/emails", () => ({ sendClaimSubmissionEmail: mocks.sendClaimSubmissionEmail }));
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
    mocks.sendClaimSubmissionEmail.mockResolvedValue(true);
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
    expect(mocks.sendClaimSubmissionEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendClaimSubmissionEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipient: customer.email,
      customerName: customer.full_name,
      claimId: "claim-id",
      claimNumber: "CLM-2026-ABC123",
      vehicle: { make: "Toyota", model: "Corolla", year: 2026 },
      accidentDate: "2026-09-01",
    }));
    expect(result).toEqual({ ok: true, claimNumber: "CLM-2026-ABC123" });
  });

  it("derives the recipient from the authenticated profile, not browser form data", async () => {
    const formData = validFormData();
    formData.set("email", "attacker@example.com");
    mocks.createServiceRoleClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [{ claim_id: "claim-id", claim_number: "CLM-2026-ABC123" }],
        error: null,
      }),
      storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }), remove: vi.fn() })) },
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }), delete: vi.fn() })),
    });

    await submitClaim(formData, customer);

    expect(mocks.sendClaimSubmissionEmail).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "customer@example.com" }),
    );
  });

  it("keeps the created claim, history, and documents when email delivery fails", async () => {
    const remove = vi.fn();
    const deleteClaim = vi.fn();
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.sendClaimSubmissionEmail.mockResolvedValue(false);
    mocks.createServiceRoleClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [{ claim_id: "claim-id", claim_number: "CLM-2026-ABC123" }],
        error: null,
      }),
      storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }), remove })) },
      from: vi.fn(() => ({ insert, delete: deleteClaim })),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await submitClaim(validFormData(), customer);

    expect(result).toEqual({ ok: true, claimNumber: "CLM-2026-ABC123" });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalled();
    expect(deleteClaim).not.toHaveBeenCalled();
  });

  it("still reports submission success if the email helper throws unexpectedly", async () => {
    const remove = vi.fn();
    const deleteClaim = vi.fn();
    mocks.sendClaimSubmissionEmail.mockRejectedValue(new Error("provider unavailable"));
    mocks.createServiceRoleClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [{ claim_id: "claim-id", claim_number: "CLM-2026-ABC123" }],
        error: null,
      }),
      storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }), remove })) },
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }), delete: deleteClaim })),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(submitClaim(validFormData(), customer)).resolves.toEqual({
      ok: true,
      claimNumber: "CLM-2026-ABC123",
    });
    expect(remove).not.toHaveBeenCalled();
    expect(deleteClaim).not.toHaveBeenCalled();
  });

  it("does not attempt email when the required document pipeline fails", async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteClaim = vi.fn(() => ({ eq: deleteEq }));
    mocks.createServiceRoleClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [{ claim_id: "claim-id", claim_number: "CLM-2026-ABC123" }],
        error: null,
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          remove: vi.fn().mockResolvedValue({ error: null }),
        })),
      },
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: { message: "metadata failed" } }),
        delete: deleteClaim,
      })),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await submitClaim(validFormData(), customer);

    expect(result.ok).toBe(false);
    expect(mocks.sendClaimSubmissionEmail).not.toHaveBeenCalled();
    expect(deleteClaim).toHaveBeenCalledTimes(1);
    expect(deleteEq).toHaveBeenCalledWith("id", "claim-id");
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
    expect(mocks.sendClaimSubmissionEmail).not.toHaveBeenCalled();
  });
});
