import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { getUser: mocks.getUser } }),
  createServiceRoleClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }) }),
}));
import { requireStaff } from "./session";

describe("staff profile route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-id", email: "work@example.com", user_metadata: { role: "ADMIN" } } }, error: null });
  });

  it.each(["CLAIMS_OFFICER", "ADMIN"])("allows the persisted %s staff role", async (role) => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "profile-id", auth_user_id: "auth-id", role, email: "work@example.com" }, error: null });
    expect((await requireStaff()).role).toBe(role);
  });

  it("rejects customers even when user-editable Auth metadata claims ADMIN", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "customer", auth_user_id: "auth-id", role: "CUSTOMER", email: "work@example.com" }, error: null });
    await expect(requireStaff()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("rejects visitors without an authenticated session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireStaff()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });
});
