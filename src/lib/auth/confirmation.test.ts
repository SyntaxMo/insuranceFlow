import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  createServerClientMock,
  exchangeCodeForSessionMock,
  verifyOtpMock,
  getUserMock,
  signOutMock,
  getProfileByAuthUserIdMock,
  synchronizeVerifiedProfileEmailMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
  verifyOtpMock: vi.fn(),
  getUserMock: vi.fn(),
  signOutMock: vi.fn(),
  getProfileByAuthUserIdMock: vi.fn(),
  synchronizeVerifiedProfileEmailMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));
vi.mock("@/lib/auth/session", () => ({
  getProfileByAuthUserId: getProfileByAuthUserIdMock,
  synchronizeVerifiedProfileEmail: synchronizeVerifiedProfileEmailMock,
  routeForRole: (role: string) =>
    role === "CUSTOMER" ? "/dashboard" : "/admin",
}));

import { handleAuthConfirmation } from "@/lib/auth/confirmation";

function request(query: string) {
  return new NextRequest(`http://localhost:3000/auth/callback${query}`);
}

describe("handleAuthConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createServerClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        verifyOtp: verifyOtpMock,
        getUser: getUserMock,
        signOut: signOutMock,
      },
    });
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    verifyOtpMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({
      data: { user: { id: "auth-user-id", email: "customer@example.com" } },
      error: null,
    });
    getProfileByAuthUserIdMock.mockResolvedValue({
      id: "profile-id",
      role: "CUSTOMER",
    });
    synchronizeVerifiedProfileEmailMock.mockImplementation(async (profile) => ({
      profile,
      changed: false,
    }));
  });

  it("exchanges a PKCE code, loads the profile, and redirects a customer", async () => {
    const response = await handleAuthConfirmation(request("?code=test-code"));

    expect(exchangeCodeForSessionMock).toHaveBeenCalledOnce();
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith(
      "test-code",
      undefined,
    );
    expect(getProfileByAuthUserIdMock).toHaveBeenCalledWith("auth-user-id");
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard?confirmed=1",
    );
  });

  it("passes the Supabase flow id when the callback includes one", async () => {
    await handleAuthConfirmation(
      request("?code=test-code&sb_flow_id=test-flow"),
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("test-code", {
      flowId: "test-flow",
    });
  });

  it("supports token-hash confirmation links", async () => {
    await handleAuthConfirmation(
      request("?token_hash=hashed-token&type=email"),
    );

    expect(verifyOtpMock).toHaveBeenCalledWith({
      token_hash: "hashed-token",
      type: "email",
    });
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });

  it("routes a verified email change to profile with a one-time success marker", async () => {
    synchronizeVerifiedProfileEmailMock.mockResolvedValue({
      profile: { id: "profile-id", role: "CUSTOMER", email: "new@example.com" },
      changed: true,
    });

    const response = await handleAuthConfirmation(
      request("?code=test-code&intent=email-change"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard/profile?emailUpdated=1",
    );
  });

  it("keeps a secure email change pending until Auth exposes the verified address", async () => {
    const response = await handleAuthConfirmation(
      request("?code=test-code&intent=email-change"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard/profile?emailChangePending=1",
    );
  });

  it("redirects staff to admin without a customer toast marker", async () => {
    getProfileByAuthUserIdMock.mockResolvedValue({
      id: "staff-profile-id",
      role: "CLAIMS_OFFICER",
    });

    const response = await handleAuthConfirmation(request("?code=test-code"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin",
    );
  });

  it("rejects a callback with no supported confirmation parameters", async () => {
    const response = await handleAuthConfirmation(request(""));

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=invalid-confirmation",
    );
  });

  it("handles an expired confirmation without exposing internals", async () => {
    verifyOtpMock.mockResolvedValue({
      error: { message: "Email link is expired" },
    });

    const response = await handleAuthConfirmation(
      request("?token_hash=hashed-token&type=email"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=expired-confirmation",
    );
  });

  it("signs out and reports a missing application profile", async () => {
    getProfileByAuthUserIdMock.mockResolvedValue(null);

    const response = await handleAuthConfirmation(request("?code=test-code"));

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=missing-profile",
    );
  });
});
