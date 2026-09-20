import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getProfileByAuthUserId: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/lib/auth/session", () => ({
  getProfileByAuthUserId: mocks.getProfileByAuthUserId,
}));

import { requestEmailChangeAction } from "@/app/dashboard/profile/actions";

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestEmailChangeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser, updateUser: mocks.updateUser },
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-customer", email: "current@example.com" } },
      error: null,
    });
    mocks.getProfileByAuthUserId.mockResolvedValue({
      id: "profile-customer",
      auth_user_id: "auth-customer",
      email: "current@example.com",
      role: "CUSTOMER",
    });
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    process.env.NEXT_PUBLIC_SITE_URL = "https://insureflow.example";
  });

  it("normalizes a valid email and asks Supabase Auth to verify it", async () => {
    const result = await requestEmailChangeAction({}, form("  NEW@Example.COM "));

    expect(result).toEqual({ success: true, pendingEmail: "new@example.com" });
    expect(mocks.getProfileByAuthUserId).toHaveBeenCalledWith("auth-customer");
    expect(mocks.updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      {
        emailRedirectTo:
          "https://insureflow.example/auth/callback?intent=email-change",
      },
    );
  });

  it("rejects invalid and unchanged email addresses before requesting a change", async () => {
    const invalid = await requestEmailChangeAction({}, form("not-an-email"));
    const unchanged = await requestEmailChangeAction({}, form("CURRENT@example.com"));

    expect(invalid.fields?.email?.[0]).toBe("Enter a valid email address.");
    expect(unchanged.fields?.email?.[0]).toMatch(/different/);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("derives identity from the session and rejects unauthenticated or staff callers", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const signedOut = await requestEmailChangeAction({}, form("new@example.com"));
    expect(signedOut.message).toMatch(/session has expired/i);

    mocks.getProfileByAuthUserId.mockResolvedValueOnce({
      id: "staff-profile",
      auth_user_id: "auth-customer",
      email: "officer@example.com",
      role: "CLAIMS_OFFICER",
    });
    const staff = await requestEmailChangeAction({}, form("new@example.com"));
    expect(staff.message).toMatch(/cannot change/i);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("keeps the verified email unchanged when Supabase rejects the request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists", message: "Email unavailable" },
    });

    const result = await requestEmailChangeAction({}, form("used@example.com"));

    expect(result.success).not.toBe(true);
    expect(result.message).toMatch(/could not send/i);
    expect(mocks.getProfileByAuthUserId).toHaveBeenCalledOnce();
  });
});
