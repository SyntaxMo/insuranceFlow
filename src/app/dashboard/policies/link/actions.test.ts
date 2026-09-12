import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCustomerMock,
  findExistingPolicyMatchMock,
  issuePolicyVerificationCodeMock,
  verifyPolicyLinkCodeMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireCustomerMock: vi.fn(),
  findExistingPolicyMatchMock: vi.fn(),
  issuePolicyVerificationCodeMock: vi.fn(),
  verifyPolicyLinkCodeMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  revalidatePathMock: vi.fn(),
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
vi.mock("@/lib/policies/policy-link-verification", () => ({
  verifyPolicyLinkCode: verifyPolicyLinkCodeMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import {
  lookupExistingPolicyAction,
  sendPolicyVerificationCodeAction,
  verifyPolicyCodeAction,
} from "@/app/dashboard/policies/link/actions";

function formData(policyNumber = "POL-2026-0101", email = "member@example.com") {
  const data = new FormData();
  data.set("policyNumber", policyNumber);
  data.set("email", email);
  return data;
}

function verificationFormData(code: string) {
  const data = formData();
  data.set("verificationCode", code);
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

describe("verifyPolicyCodeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomerMock.mockResolvedValue({
      id: "authenticated-profile-id",
      role: "CUSTOMER",
    });
  });

  it("rejects malformed codes before verification", async () => {
    const result = await verifyPolicyCodeAction({}, verificationFormData("12A45"));

    expect(result.fieldError).toBe("Enter the 6-digit verification code.");
    expect(verifyPolicyLinkCodeMock).not.toHaveBeenCalled();
  });

  it("uses the authenticated customer and redirects after successful linking", async () => {
    verifyPolicyLinkCodeMock.mockResolvedValue({ ok: true });

    await expect(
      verifyPolicyCodeAction({}, verificationFormData("123456")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(verifyPolicyLinkCodeMock).toHaveBeenCalledWith({
      requestingUserId: "authenticated-profile-id",
      policyNumber: "POL-2026-0101",
      submittedEmail: "member@example.com",
      otp: "123456",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard?policyLinked=1");
  });

  it("returns the attempt-limit message without redirecting", async () => {
    verifyPolicyLinkCodeMock.mockResolvedValue({ ok: false, reason: "attempts" });

    const result = await verifyPolicyCodeAction({}, verificationFormData("123456"));

    expect(result.message).toBe(
      "Too many incorrect attempts. Request a new verification code.",
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
