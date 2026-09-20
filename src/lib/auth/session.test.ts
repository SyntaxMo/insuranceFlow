import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  createServerClient: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
  createServerClient: mocks.createServerClient,
}));

import { synchronizeVerifiedProfileEmail } from "@/lib/auth/session";

const profile = {
  id: "profile-id",
  auth_user_id: "auth-id",
  full_name: "Customer",
  email: "old@example.com",
  phone: null,
  role: "CUSTOMER" as const,
  created_at: "2025-01-01T00:00:00.000Z",
};

describe("synchronizeVerifiedProfileEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      update: mocks.update,
      eq: mocks.eq,
      select: mocks.select,
      single: mocks.single,
    };
    mocks.createServiceRoleClient.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue(query);
    mocks.update.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.single.mockResolvedValue({
      data: { ...profile, email: "new@example.com" },
      error: null,
    });
  });

  it("updates only the profile email after the trusted Auth email changes", async () => {
    const result = await synchronizeVerifiedProfileEmail(profile, {
      id: "auth-id",
      email: "NEW@example.com",
    });

    expect(mocks.update).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", "profile-id");
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "auth_user_id", "auth-id");
    expect(result.changed).toBe(true);
    expect(result.profile.email).toBe("new@example.com");
    expect(result.profile.auth_user_id).toBe("auth-id");
    expect(result.profile.role).toBe("CUSTOMER");
  });

  it("does not write while the verified Auth email is still unchanged", async () => {
    const result = await synchronizeVerifiedProfileEmail(profile, {
      id: "auth-id",
      email: "old@example.com",
    });

    expect(result).toEqual({ profile, changed: false });
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("does not synchronize an Auth identity that does not own the profile", async () => {
    const result = await synchronizeVerifiedProfileEmail(profile, {
      id: "another-auth-id",
      email: "new@example.com",
    });

    expect(result).toEqual({ profile, changed: false });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
