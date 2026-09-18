import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedProfileMock } = vi.hoisted(() => ({
  getAuthenticatedProfileMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedProfile: getAuthenticatedProfileMock,
}));

import { GET } from "@/app/api/auth/session-profile/route";

describe("GET /api/auth/session-profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the server-resolved auth identity and application role", async () => {
    getAuthenticatedProfileMock.mockResolvedValue({
      auth_user_id: "auth-user-1",
      role: "CLAIMS_OFFICER",
    });

    const response = await GET();

    expect(await response.json()).toEqual({
      authenticated: true,
      userId: "auth-user-1",
      role: "CLAIMS_OFFICER",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns a safe signed-out result without exposing profile details", async () => {
    getAuthenticatedProfileMock.mockResolvedValue(null);

    const response = await GET();

    expect(await response.json()).toEqual({ authenticated: false });
  });
});
