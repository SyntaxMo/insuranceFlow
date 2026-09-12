import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceRoleClientMock, resolveExistingPolicyMatchMock } = vi.hoisted(
  () => ({
    createServiceRoleClientMock: vi.fn(),
    resolveExistingPolicyMatchMock: vi.fn(),
  }),
);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));
vi.mock("@/lib/policies/link-existing", () => ({
  resolveExistingPolicyMatch: resolveExistingPolicyMatchMock,
  maskEmail: vi.fn(),
}));

import { hashPolicyLinkOtp } from "@/lib/policies/policy-link-otp";
import {
  otpHashesMatch,
  verifyPolicyLinkCode,
} from "@/lib/policies/policy-link-verification";

const originalSecret = process.env.OTP_HASH_SECRET;
const now = new Date("2026-09-13T10:00:00.000Z");

function verificationClient({
  verification,
  rpcResults = [],
}: {
  verification: Record<string, unknown> | null;
  rpcResults?: Array<{ data: unknown; error: { message: string } | null }>;
}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: verification, error: null });

  const rpc = vi.fn();
  for (const result of rpcResults) rpc.mockResolvedValueOnce(result);
  createServiceRoleClientMock.mockReturnValue({
    from: vi.fn(() => query),
    rpc,
  });
  return { query, rpc };
}

function storedHash(code: string): string {
  return hashPolicyLinkOtp({
    otp: code,
    requestingUserId: "portal-user-id",
    policyId: "policy-id",
    secret: "test-secret",
  });
}

async function verify(code: string) {
  return verifyPolicyLinkCode({
    requestingUserId: "portal-user-id",
    policyNumber: "POL-1",
    submittedEmail: "registered@example.com",
    otp: code,
    now,
  });
}

describe("policy link OTP verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OTP_HASH_SECRET = "test-secret";
    resolveExistingPolicyMatchMock.mockResolvedValue({
      policyId: "policy-id",
      targetEmail: "registered@example.com",
      match: {},
    });
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.OTP_HASH_SECRET;
    else process.env.OTP_HASH_SECRET = originalSecret;
  });

  it("uses a timing-safe comparison for equal SHA-256 HMAC values", () => {
    const hash = storedHash("123456");
    expect(otpHashesMatch(hash, hash)).toBe(true);
    expect(otpHashesMatch(hash, storedHash("654321"))).toBe(false);
    expect(otpHashesMatch("not-a-hash", hash)).toBe(false);
  });

  it("links and consumes through one atomic completion RPC for a correct code", async () => {
    const database = verificationClient({
      verification: {
        id: "verification-id",
        otp_hash: storedHash("123456"),
        expires_at: "2026-09-13T10:10:00.000Z",
        attempt_count: 0,
      },
      rpcResults: [{ data: "linked", error: null }],
    });

    await expect(verify("123456")).resolves.toEqual({ ok: true });
    expect(database.rpc).toHaveBeenCalledWith(
      "complete_policy_link_verification",
      {
        p_verification_id: "verification-id",
        p_requesting_user_id: "portal-user-id",
        p_policy_id: "policy-id",
      },
    );
  });

  it("atomically increments a wrong attempt without creating a link", async () => {
    const database = verificationClient({
      verification: {
        id: "verification-id",
        otp_hash: storedHash("123456"),
        expires_at: "2026-09-13T10:10:00.000Z",
        attempt_count: 1,
      },
      rpcResults: [{ data: 2, error: null }],
    });

    await expect(verify("999999")).resolves.toEqual({
      ok: false,
      reason: "incorrect",
    });
    expect(database.rpc).toHaveBeenCalledOnce();
    expect(database.rpc).toHaveBeenCalledWith(
      "increment_policy_link_verification_attempt",
      expect.any(Object),
    );
  });

  it("blocks the OTP when the fifth wrong attempt is recorded", async () => {
    verificationClient({
      verification: {
        id: "verification-id",
        otp_hash: storedHash("123456"),
        expires_at: "2026-09-13T10:10:00.000Z",
        attempt_count: 4,
      },
      rpcResults: [{ data: 5, error: null }],
    });

    await expect(verify("999999")).resolves.toEqual({
      ok: false,
      reason: "attempts",
    });
  });

  it("rejects expired and already-consumed verification records", async () => {
    verificationClient({
      verification: {
        id: "verification-id",
        otp_hash: storedHash("123456"),
        expires_at: "2026-09-13T09:59:59.000Z",
        attempt_count: 0,
      },
    });
    await expect(verify("123456")).resolves.toEqual({
      ok: false,
      reason: "expired",
    });

    verificationClient({ verification: null });
    await expect(verify("123456")).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("accepts an existing same-user link and blocks another user's link", async () => {
    verificationClient({
      verification: {
        id: "verification-id",
        otp_hash: storedHash("123456"),
        expires_at: "2026-09-13T10:10:00.000Z",
        attempt_count: 0,
      },
      rpcResults: [{ data: "already_linked", error: null }],
    });
    await expect(verify("123456")).resolves.toEqual({ ok: true });

    verificationClient({
      verification: {
        id: "verification-id-2",
        otp_hash: storedHash("123456"),
        expires_at: "2026-09-13T10:10:00.000Z",
        attempt_count: 0,
      },
      rpcResults: [{ data: "linked_other", error: null }],
    });
    await expect(verify("123456")).resolves.toEqual({
      ok: false,
      reason: "linked_other",
    });
  });
});
