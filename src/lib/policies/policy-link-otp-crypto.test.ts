import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  generateNumericOtp,
  hashPolicyLinkOtp,
  MAX_OTP_ATTEMPTS,
} from "@/lib/policies/policy-link-otp";

describe("policy link OTP cryptography", () => {
  it("defines the verification attempt limit for the next milestone", () => {
    expect(MAX_OTP_ATTEMPTS).toBe(5);
  });

  it("generates exactly six numeric digits", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateNumericOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("uses a context-bound SHA-256 HMAC", () => {
    const expected = createHmac("sha256", "secret")
      .update("user-id:policy-id:012345")
      .digest("hex");

    expect(
      hashPolicyLinkOtp({
        otp: "012345",
        requestingUserId: "user-id",
        policyId: "policy-id",
        secret: "secret",
      }),
    ).toBe(expected);
  });
});
