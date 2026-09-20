import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getProfileByAuthUserId: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  getProfileByAuthUserId: mocks.getProfileByAuthUserId,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

import { updateFullNameAction } from "@/app/dashboard/profile/actions";

function form(fullName: string, extra?: Record<string, string>) {
  const data = new FormData();
  data.set("fullName", fullName);
  for (const [key, value] of Object.entries(extra ?? {})) data.set(key, value);
  return data;
}

describe("updateFullNameAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      update: mocks.update,
      eq: mocks.eq,
      select: mocks.select,
      single: mocks.single,
    };
    mocks.createServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createServiceRoleClient.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue(query);
    mocks.update.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.single.mockResolvedValue({
      data: { full_name: "Maryam O'Neil-Sayed" },
      error: null,
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-customer" } },
      error: null,
    });
    mocks.getProfileByAuthUserId.mockResolvedValue({
      id: "profile-customer",
      auth_user_id: "auth-customer",
      role: "CUSTOMER",
    });
  });

  it("trims and persists a valid name without restricting legitimate characters", async () => {
    const result = await updateFullNameAction({}, form("  Maryam O'Neil-Sayed  "));

    expect(mocks.update).toHaveBeenCalledWith({ full_name: "Maryam O'Neil-Sayed" });
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", "profile-customer");
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "auth_user_id", "auth-customer");
    expect(result).toEqual({ success: true, fullName: "Maryam O'Neil-Sayed" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/profile");
  });

  it.each(["", "   "])("rejects an empty name value %#", async (value) => {
    const result = await updateFullNameAction({}, form(value));
    expect(result.fields?.fullName?.[0]).toBe("Enter your full name.");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects names longer than 100 characters", async () => {
    const result = await updateFullNameAction({}, form("x".repeat(101)));
    expect(result.fields?.fullName?.[0]).toMatch(/100 characters/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("derives the target profile from the authenticated customer", async () => {
    await updateFullNameAction(
      {},
      form("Updated Name", { profileId: "another-profile", userId: "another-user" }),
    );

    expect(mocks.getProfileByAuthUserId).toHaveBeenCalledWith("auth-customer");
    expect(mocks.eq).toHaveBeenCalledWith("id", "profile-customer");
    expect(mocks.eq).not.toHaveBeenCalledWith("id", "another-profile");
  });

  it("rejects unauthenticated, Claims Officer, and Admin callers", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const signedOut = await updateFullNameAction({}, form("Updated Name"));
    expect(signedOut.message).toMatch(/session has expired/i);

    for (const role of ["CLAIMS_OFFICER", "ADMIN"] as const) {
      mocks.getProfileByAuthUserId.mockResolvedValueOnce({
        id: "staff-profile",
        auth_user_id: "auth-customer",
        role,
      });
      const result = await updateFullNameAction({}, form("Updated Name"));
      expect(result.message).toMatch(/cannot update/i);
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns a safe retryable error without changing the displayed name", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.single.mockResolvedValue({
      data: null,
      error: { code: "UPDATE_FAILED", message: "internal details" },
    });

    const result = await updateFullNameAction({}, form("Updated Name"));
    expect(result).toEqual({ message: "We could not update your name. Please try again." });
    expect(JSON.stringify(result)).not.toContain("internal details");
  });
});
