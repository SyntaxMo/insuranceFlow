import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./session", () => ({ getAuthenticatedProfile: m.profile }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
import { getAdminForApi, requireAdmin } from "./admin";
describe("ADMIN-only guards", () => {
  beforeEach(() => { vi.clearAllMocks(); m.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); }); });
  it("authorizes the server role, not a special email address", async () => {
    const admin = { role: "ADMIN", email: "ordinary@example.com" }; m.profile.mockResolvedValue(admin);
    expect(await getAdminForApi()).toBe(admin); expect(await requireAdmin()).toBe(admin);
  });
  it.each([[null, "/login"], [{ role: "CUSTOMER", email: "admin@test.com" }, "/dashboard"], [{ role: "CLAIMS_OFFICER" }, "/admin/claims"]])("rejects non-admin %j", async (profile, route) => {
    m.profile.mockResolvedValue(profile);
    expect(await getAdminForApi()).toBeNull(); await expect(requireAdmin()).rejects.toThrow(`redirect:${route}`);
  });
});
