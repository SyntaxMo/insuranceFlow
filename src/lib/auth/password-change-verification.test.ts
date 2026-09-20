import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  queryResult: { data: null as unknown, error: null as unknown },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

import {
  hashPasswordChangeOtp,
  verifyAndConsumePasswordChangeCode,
} from "@/lib/auth/password-change-verification";

function queryBuilder() {
  const builder = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  Object.values(builder).forEach((method) => method.mockReturnValue(builder));
  builder.maybeSingle.mockImplementation(async () => mocks.queryResult);
  return builder;
}

const now = new Date("2026-09-20T12:00:00.000Z");
const secret = "test-password-verification-secret";

function activeChallenge(otp = "65872570") {
  return {
    id: "challenge-1",
    otp_hash: hashPasswordChangeOtp({ otp, portalUserId: "profile-customer", authUserId: "auth-customer", secret }),
    expires_at: "2026-09-20T12:10:00.000Z",
    attempt_count: 0,
  };
}

describe("password change verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OTP_HASH_SECRET = secret;
    mocks.from.mockImplementation(() => queryBuilder());
    mocks.createServiceRoleClient.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: "consumed", error: null });
    mocks.queryResult = { data: activeChallenge(), error: null };
  });

  it("rejects the exact extra-digit regression and records a failed attempt", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 1, error: null });
    const result = await verifyAndConsumePasswordChangeCode({
      portalUserId: "profile-customer", authUserId: "auth-customer", otp: "658725701", now,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(mocks.rpc).toHaveBeenCalledWith("increment_password_change_verification_attempt", {
      p_verification_id: "challenge-1", p_portal_user_id: "profile-customer", p_auth_user_id: "auth-customer",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("consume_password_change_verification", expect.anything());
  });

  it("rejects a wrong code and locks the challenge after the maximum attempt", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 5, error: null });
    const result = await verifyAndConsumePasswordChangeCode({
      portalUserId: "profile-customer", authUserId: "auth-customer", otp: "00000000", now,
    });
    expect(result).toEqual({ ok: false, reason: "attempts" });
  });

  it("rejects and consumes an expired challenge", async () => {
    mocks.queryResult = { data: { ...activeChallenge(), expires_at: "2026-09-20T11:59:59.000Z" }, error: null };
    const result = await verifyAndConsumePasswordChangeCode({
      portalUserId: "profile-customer", authUserId: "auth-customer", otp: "65872570", now,
    });
    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(mocks.rpc).toHaveBeenCalledWith("consume_password_change_verification", expect.objectContaining({ p_verification_id: "challenge-1" }));
  });

  it("rejects a missing, reused, or other-customer challenge", async () => {
    mocks.queryResult = { data: null, error: null };
    const result = await verifyAndConsumePasswordChangeCode({
      portalUserId: "different-profile", authUserId: "different-auth", otp: "65872570", now,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("atomically consumes the valid one-time challenge", async () => {
    const result = await verifyAndConsumePasswordChangeCode({
      portalUserId: "profile-customer", authUserId: "auth-customer", otp: "65872570", now,
    });
    expect(result).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("consume_password_change_verification", {
      p_verification_id: "challenge-1", p_portal_user_id: "profile-customer", p_auth_user_id: "auth-customer",
    });
  });
});
