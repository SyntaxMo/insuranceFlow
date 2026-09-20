import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(), getProfileByAuthUserId: vi.fn(), getUser: vi.fn(),
  updateUser: vi.fn(), issuePasswordChangeCode: vi.fn(), verifyAndConsumePasswordChangeCode: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: mocks.createServerClient, createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getProfileByAuthUserId: mocks.getProfileByAuthUserId }));
vi.mock("@/lib/auth/password-change-verification", () => ({
  issuePasswordChangeCode: mocks.issuePasswordChangeCode,
  verifyAndConsumePasswordChangeCode: mocks.verifyAndConsumePasswordChangeCode,
}));

import { requestPasswordChangeCodeAction, updatePasswordAction } from "@/app/dashboard/profile/actions";

function passwordForm({ code = "65872570", password = "NewSecurePassword1!", confirmation = password }: {
  code?: string; password?: string; confirmation?: string;
} = {}) {
  const data = new FormData();
  data.set("verificationCode", code);
  data.set("password", password);
  data.set("confirmPassword", confirmation);
  return data;
}

describe("customer password change actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser, updateUser: mocks.updateUser } });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-customer", email: "verified@example.com", email_confirmed_at: "2026-09-20T08:00:00.000Z" } },
      error: null,
    });
    mocks.getProfileByAuthUserId.mockResolvedValue({ id: "profile-customer", auth_user_id: "auth-customer", email: "verified@example.com", role: "CUSTOMER" });
    mocks.issuePasswordChangeCode.mockResolvedValue({ ok: true, cooldownSeconds: 60 });
    mocks.verifyAndConsumePasswordChangeCode.mockResolvedValue({ ok: true });
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
  });

  it("sends the code to the authenticated customer's verified email", async () => {
    const form = new FormData();
    form.set("email", "attacker@example.com");
    expect(await requestPasswordChangeCodeAction({}, form)).toEqual({ success: true });
    expect(mocks.issuePasswordChangeCode).toHaveBeenCalledWith({ portalUserId: "profile-customer", authUserId: "auth-customer", targetEmail: "verified@example.com" });
  });

  it.each([
    ["signed out", { data: { user: null }, error: null }, null, /session has expired/i],
    ["staff", { data: { user: { id: "auth-staff", email: "staff@example.com", email_confirmed_at: "2026-09-20T08:00:00.000Z" } }, error: null }, { id: "staff-profile", role: "CLAIMS_OFFICER" }, /cannot change/i],
  ])("rejects %s password verification requests", async (_label, userResult, profile, message) => {
    mocks.getUser.mockResolvedValueOnce(userResult);
    if (profile) mocks.getProfileByAuthUserId.mockResolvedValueOnce(profile);
    const result = await requestPasswordChangeCodeAction({}, new FormData());
    expect(result.message).toMatch(message);
    expect(mocks.issuePasswordChangeCode).not.toHaveBeenCalled();
  });

  it("blocks the manually reproduced extra-digit code before changing the password", async () => {
    const result = await updatePasswordAction({}, passwordForm({ code: "658725701" }));
    expect(result.fields?.verificationCode?.[0]).toBe("Enter the 8-digit verification code.");
    expect(mocks.verifyAndConsumePasswordChangeCode).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["incorrect", /incorrect/i], ["expired", /expired/i], ["attempts", /too many/i],
    ["used", /already been used/i], ["invalid", /incorrect/i],
  ])("does not update the password for a %s challenge", async (reason, expected) => {
    mocks.verifyAndConsumePasswordChangeCode.mockResolvedValueOnce({ ok: false, reason });
    const result = await updatePasswordAction({}, passwordForm());
    expect(Object.values(result.fields ?? {}).flat().join(" ")).toMatch(expected);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("consumes a valid challenge before updating the authenticated user's password", async () => {
    expect(await updatePasswordAction({}, passwordForm())).toEqual({ success: true });
    expect(mocks.verifyAndConsumePasswordChangeCode).toHaveBeenCalledWith({ portalUserId: "profile-customer", authUserId: "auth-customer", otp: "65872570" });
    expect(mocks.verifyAndConsumePasswordChangeCode.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0]);
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "NewSecurePassword1!" });
  });

  it("rejects mismatched and weak passwords before challenge verification", async () => {
    const mismatch = await updatePasswordAction({}, passwordForm({ confirmation: "DifferentPassword1!" }));
    const weak = await updatePasswordAction({}, passwordForm({ password: "short" }));
    expect(mismatch.fields?.confirmPassword?.[0]).toBe("Passwords do not match.");
    expect(weak.fields?.password?.[0]).toMatch(/at least 8/i);
    expect(mocks.verifyAndConsumePasswordChangeCode).not.toHaveBeenCalled();
  });

  it("does not permit signed-out or staff accounts to update a password", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await updatePasswordAction({}, passwordForm())).message).toMatch(/session/i);
    mocks.getProfileByAuthUserId.mockResolvedValueOnce({ id: "staff-profile", role: "ADMIN" });
    expect((await updatePasswordAction({}, passwordForm())).message).toMatch(/cannot change/i);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
