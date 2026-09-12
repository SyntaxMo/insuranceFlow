import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServiceRoleClientMock,
  resolveExistingPolicyMatchMock,
  randomIntMock,
  hmacUpdateMock,
  hmacDigestMock,
} = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
  resolveExistingPolicyMatchMock: vi.fn(),
  randomIntMock: vi.fn(),
  hmacUpdateMock: vi.fn(),
  hmacDigestMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", () => ({
  randomInt: randomIntMock,
  createHmac: vi.fn(() => ({
    update: hmacUpdateMock,
    digest: hmacDigestMock,
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));
vi.mock("@/lib/policies/link-existing", () => ({
  resolveExistingPolicyMatch: resolveExistingPolicyMatchMock,
  maskEmail: () => "s••••d@example.com",
}));

import { issuePolicyVerificationCode } from "@/lib/policies/policy-link-otp";

const originalResendApiKey = process.env.RESEND_API_KEY;
const originalOtpHashSecret = process.env.OTP_HASH_SECRET;

function verificationClient(activeRows: Array<{ id: string; created_at: string }> = []) {
  const cooldown = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  cooldown.select.mockReturnValue(cooldown);
  cooldown.eq.mockReturnValue(cooldown);
  cooldown.is.mockReturnValue(cooldown);
  cooldown.order.mockReturnValue(cooldown);
  cooldown.limit.mockResolvedValue({ data: activeRows, error: null });

  const invalidate = { delete: vi.fn(), eq: vi.fn(), is: vi.fn() };
  invalidate.delete.mockReturnValue(invalidate);
  invalidate.eq.mockReturnValue(invalidate);
  invalidate.is.mockResolvedValue({ error: null });

  const inserted: { value?: Record<string, unknown> } = {};
  const insertResult = {
    insert: vi.fn((value: Record<string, unknown>) => {
      inserted.value = value;
      return insertResult;
    }),
    select: vi.fn(() => insertResult),
    single: vi.fn().mockResolvedValue({
      data: { id: "verification-id" },
      error: null,
    }),
  };

  const cleanup = { delete: vi.fn(), eq: vi.fn() };
  cleanup.delete.mockReturnValue(cleanup);
  cleanup.eq.mockResolvedValue({ error: null });

  const from = vi
    .fn()
    .mockReturnValueOnce(cooldown)
    .mockReturnValueOnce(invalidate)
    .mockReturnValueOnce(insertResult)
    .mockReturnValueOnce(cleanup);
  createServiceRoleClientMock.mockReturnValue({ from });
  return { from, invalidate, insertResult, inserted, cleanup };
}

describe("policy link OTP issuing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.OTP_HASH_SECRET = "test-hmac-secret";
    randomIntMock.mockReturnValue(123456);
    hmacUpdateMock.mockReturnValue({ digest: hmacDigestMock });
    hmacDigestMock.mockReturnValue("stored-hmac-value");
    resolveExistingPolicyMatchMock.mockResolvedValue({
      policyId: "policy-id",
      targetEmail: "stored@example.com",
      match: {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendApiKey;
    if (originalOtpHashSecret === undefined) delete process.env.OTP_HASH_SECRET;
    else process.env.OTP_HASH_SECRET = originalOtpHashSecret;
  });

  it("sends one OTP to the stored email and stores only its HMAC", async () => {
    const database = verificationClient();
    const now = new Date("2026-09-12T10:00:00.000Z");

    const result = await issuePolicyVerificationCode({
      requestingUserId: "authenticated-profile-id",
      policyNumber: "POL-2026-0101",
      submittedEmail: "attacker-controlled@example.net",
      now,
    });

    expect(result).toEqual({
      ok: true,
      maskedEmail: "s••••d@example.com",
      cooldownSeconds: 60,
    });
    expect(fetch).toHaveBeenCalledOnce();
    const request = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body));
    expect(body.to).toEqual(["stored@example.com"]);
    expect(body.to).not.toContain("attacker-controlled@example.net");
    expect(body.subject).toBe("Verify your InsureFlow policy");
    expect(body.text).toContain("123456");
    expect(database.inserted.value).toMatchObject({
      requesting_user_id: "authenticated-profile-id",
      policy_id: "policy-id",
      target_email: "stored@example.com",
      otp_hash: "stored-hmac-value",
      expires_at: "2026-09-12T10:10:00.000Z",
      attempt_count: 0,
      consumed_at: null,
    });
    expect(JSON.stringify(database.inserted.value)).not.toContain("123456");
    expect(hmacUpdateMock).toHaveBeenCalledWith(
      "authenticated-profile-id:policy-id:123456",
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "123456",
    );
  });

  it("blocks a second request inside the 60-second cooldown", async () => {
    const database = verificationClient([
      { id: "active-id", created_at: "2026-09-12T09:59:30.000Z" },
    ]);

    const result = await issuePolicyVerificationCode({
      requestingUserId: "authenticated-profile-id",
      policyNumber: "POL-2026-0101",
      submittedEmail: "stored@example.com",
      now: new Date("2026-09-12T10:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: false,
      reason: "cooldown",
      retryAfterSeconds: 30,
    });
    expect(database.from).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("invalidates an old unused OTP and creates a new one after cooldown", async () => {
    const database = verificationClient([
      { id: "old-active-id", created_at: "2026-09-12T09:58:00.000Z" },
    ]);

    const result = await issuePolicyVerificationCode({
      requestingUserId: "authenticated-profile-id",
      policyNumber: "POL-2026-0101",
      submittedEmail: "stored@example.com",
      now: new Date("2026-09-12T10:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(database.invalidate.delete).toHaveBeenCalledOnce();
    expect(database.invalidate.eq).toHaveBeenNthCalledWith(
      1,
      "requesting_user_id",
      "authenticated-profile-id",
    );
    expect(database.invalidate.eq).toHaveBeenNthCalledWith(
      2,
      "policy_id",
      "policy-id",
    );
    expect(database.invalidate.is).toHaveBeenCalledWith("consumed_at", null);
    expect(database.insertResult.insert).toHaveBeenCalledOnce();
  });

  it("removes the verification record if Resend fails", async () => {
    const database = verificationClient();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    const result = await issuePolicyVerificationCode({
      requestingUserId: "authenticated-profile-id",
      policyNumber: "POL-2026-0101",
      submittedEmail: "stored@example.com",
    });

    expect(result).toEqual({ ok: false, reason: "delivery" });
    expect(database.cleanup.delete).toHaveBeenCalledOnce();
    expect(database.cleanup.eq).toHaveBeenCalledWith("id", "verification-id");
  });

  it("fails safely before lookup when server secrets are missing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.OTP_HASH_SECRET;

    const result = await issuePolicyVerificationCode({
      requestingUserId: "authenticated-profile-id",
      policyNumber: "POL-2026-0101",
      submittedEmail: "stored@example.com",
    });

    expect(result).toEqual({ ok: false, reason: "configuration" });
    expect(resolveExistingPolicyMatchMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
