import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCustomerMock,
  findExistingPolicyMatchMock,
  issuePolicyVerificationCodeMock,
} = vi.hoisted(() => ({
  requireCustomerMock: vi.fn(),
  findExistingPolicyMatchMock: vi.fn(),
  issuePolicyVerificationCodeMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireCustomer: requireCustomerMock }));
vi.mock("@/lib/policies/link-existing", () => ({
  findExistingPolicyMatch: findExistingPolicyMatchMock,
  normalizePolicyNumber: (value: string) => value.trim().toUpperCase(),
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
  POLICY_LOOKUP_ERROR:
    "We couldn't verify a policy with those details. Check the information and try again.",
}));
vi.mock("@/lib/policies/policy-link-otp", () => ({
  issuePolicyVerificationCode: issuePolicyVerificationCodeMock,
}));

import {
  lookupExistingPolicyAction,
  sendPolicyVerificationCodeAction,
} from "@/app/dashboard/policies/link/actions";

function formData(policyNumber = "POL-2026-0101", email = "member@example.com") {
  const data = new FormData();
  data.set("policyNumber", policyNumber);
  data.set("email", email);
  return data;
}

describe("lookupExistingPolicyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomerMock.mockResolvedValue({ id: "authenticated-profile-id", role: "CUSTOMER" });
  });

  it("authorizes the customer before performing the server-side lookup", async () => {
    findExistingPolicyMatchMock.mockResolvedValue(null);

    const result = await lookupExistingPolicyAction({}, formData());

    expect(requireCustomerMock).toHaveBeenCalledOnce();
    expect(
      requireCustomerMock.mock.invocationCallOrder[0],
    ).toBeLessThan(findExistingPolicyMatchMock.mock.invocationCallOrder[0]);
    expect(result.message).toBe(
      "We couldn't verify a policy with those details. Check the information and try again.",
    );
  });

  it("does not perform a lookup when input validation fails", async () => {
    const result = await lookupExistingPolicyAction(
      {},
      formData("%", "not-an-email"),
    );

    expect(requireCustomerMock).toHaveBeenCalledOnce();
    expect(findExistingPolicyMatchMock).not.toHaveBeenCalled();
    expect(result.fields?.policyNumber).toBeDefined();
    expect(result.fields?.email).toBeDefined();
  });

  it("does not query policy data when customer authorization fails", async () => {
    requireCustomerMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      lookupExistingPolicyAction({}, formData()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(findExistingPolicyMatchMock).not.toHaveBeenCalled();
  });
});

describe("sendPolicyVerificationCodeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomerMock.mockResolvedValue({
      id: "authenticated-profile-id",
      role: "CUSTOMER",
    });
  });

  it("uses the authenticated profile id when issuing a code", async () => {
    issuePolicyVerificationCodeMock.mockResolvedValue({
      ok: true,
      maskedEmail: "m••••r@example.com",
      cooldownSeconds: 60,
    });

    const result = await sendPolicyVerificationCodeAction({}, formData());

    expect(issuePolicyVerificationCodeMock).toHaveBeenCalledWith({
      requestingUserId: "authenticated-profile-id",
      policyNumber: "POL-2026-0101",
      submittedEmail: "member@example.com",
    });
    expect(result.sent).toBe(true);
    expect(result.maskedEmail).toBe("m••••r@example.com");
  });

  it("blocks the send when customer authentication fails", async () => {
    requireCustomerMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      sendPolicyVerificationCodeAction({}, formData()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(issuePolicyVerificationCodeMock).not.toHaveBeenCalled();
  });

  it("returns the required cooldown message", async () => {
    issuePolicyVerificationCodeMock.mockResolvedValue({
      ok: false,
      reason: "cooldown",
      retryAfterSeconds: 42,
    });

    const result = await sendPolicyVerificationCodeAction({}, formData());

    expect(result.message).toBe(
      "Please wait before requesting another verification code.",
    );
    expect(result.cooldownSeconds).toBe(42);
  });
});
