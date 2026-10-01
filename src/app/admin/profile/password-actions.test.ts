import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(), getProfileByAuthUserId: vi.fn(), getUser: vi.fn(),
  updateUser: vi.fn(), issuePasswordChangeCode: vi.fn(), verifyAndConsumePasswordChangeCode: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/auth/session", () => ({
  getProfileByAuthUserId: mocks.getProfileByAuthUserId,
  isStaffRole: (role: string) => role === "CLAIMS_OFFICER" || role === "ADMIN",
}));
vi.mock("@/lib/auth/password-change-verification", () => ({
  issuePasswordChangeCode: mocks.issuePasswordChangeCode,
  verifyAndConsumePasswordChangeCode: mocks.verifyAndConsumePasswordChangeCode,
}));
import { requestPasswordChangeCodeAction, updatePasswordAction } from "./actions";

function form(code = "65872570") {
  const data = new FormData();
  data.set("verificationCode", code);
  data.set("password", "NewSecurePassword1!");
  data.set("confirmPassword", "NewSecurePassword1!");
  // None of these browser fields may determine the actor or modify metadata.
  for (const key of ["profileId", "authUserId", "userId", "email", "role", "fullName"]) data.set(key, "attacker");
  return data;
}

describe("staff password actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser, updateUser: mocks.updateUser } });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "staff-auth", email: "staff@example.com", email_confirmed_at: "2026-10-01" } }, error: null });
    mocks.getProfileByAuthUserId.mockResolvedValue({ id: "staff-profile", auth_user_id: "staff-auth", role: "CLAIMS_OFFICER" });
    mocks.issuePasswordChangeCode.mockResolvedValue({ ok: true });
    mocks.verifyAndConsumePasswordChangeCode.mockResolvedValue({ ok: true });
    mocks.updateUser.mockResolvedValue({ error: null });
  });

  it.each(["CLAIMS_OFFICER", "ADMIN"])("binds %s verification and password update to the authenticated account", async (role) => {
    mocks.getProfileByAuthUserId.mockResolvedValue({ id: "staff-profile", auth_user_id: "staff-auth", role });
    expect(await requestPasswordChangeCodeAction({}, form())).toEqual({ success: true });
    expect(mocks.issuePasswordChangeCode).toHaveBeenCalledWith({ portalUserId: "staff-profile", authUserId: "staff-auth", targetEmail: "staff@example.com" });
    expect(await updatePasswordAction({}, form())).toEqual({ success: true });
    expect(mocks.verifyAndConsumePasswordChangeCode).toHaveBeenCalledWith({ portalUserId: "staff-profile", authUserId: "staff-auth", otp: "65872570" });
    expect(mocks.verifyAndConsumePasswordChangeCode.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0]);
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "NewSecurePassword1!" });
  });

  it.each(["CUSTOMER", "UNKNOWN"])("rejects %s even with browser-supplied staff identity", async (role) => {
    mocks.getProfileByAuthUserId.mockResolvedValue({ id: "profile", role });
    expect((await requestPasswordChangeCodeAction({}, form())).success).not.toBe(true);
    expect((await updatePasswordAction({}, form())).success).not.toBe(true);
    expect(mocks.issuePasswordChangeCode).not.toHaveBeenCalled();
    expect(mocks.verifyAndConsumePasswordChangeCode).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests and unverified email accounts", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await requestPasswordChangeCodeAction({}, form())).message).toMatch(/session/i);
    expect((await updatePasswordAction({}, form())).message).toMatch(/session/i);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "staff-auth", email: "staff@example.com", email_confirmed_at: null } }, error: null });
    expect((await requestPasswordChangeCodeAction({}, form())).message).toMatch(/verified/i);
    expect((await updatePasswordAction({}, form())).message).toMatch(/verified/i);
    expect(mocks.issuePasswordChangeCode).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each(["incorrect", "invalid", "expired", "used", "attempts"])("never updates for a %s challenge", async (reason) => {
    mocks.verifyAndConsumePasswordChangeCode.mockResolvedValue({ ok: false, reason });
    expect((await updatePasswordAction({}, form())).fields?.verificationCode).toBeTruthy();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects extra digits and mismatched passwords before consumption", async () => {
    expect((await updatePasswordAction({}, form("658725701"))).fields?.verificationCode).toBeTruthy();
    const mismatch = form(); mismatch.set("confirmPassword", "DifferentPassword1!");
    expect((await updatePasswordAction({}, mismatch)).fields?.confirmPassword).toEqual(["Passwords do not match."]);
    expect(mocks.verifyAndConsumePasswordChangeCode).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("preserves safe same-password feedback and resend cooldown", async () => {
    mocks.updateUser.mockResolvedValue({ error: { code: "same_password", message: "private provider detail" } });
    expect((await updatePasswordAction({}, form())).fields?.password).toEqual(["Choose a password different from your current password."]);
    mocks.issuePasswordChangeCode.mockResolvedValue({ ok: false, reason: "cooldown" });
    expect(await requestPasswordChangeCodeAction({ success: true }, form())).toEqual({ success: true, message: "Please wait before requesting another code." });
  });
});
