import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ guard: vi.fn(), client: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), authGet: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin", () => ({ requireAdmin: m.guard }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: m.client }));
import { adminPageNumber, getAdminOverview, listClaimsOfficers, listDeletionRequests } from "./accounts";

describe("ADMIN data minimization and access", () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.guard.mockResolvedValue({ role: "ADMIN" });
    const q = { select: m.select, eq: m.eq, order: m.order, range: m.range };
    for (const fn of [m.from, m.select, m.eq, m.order]) fn.mockReturnValue(q);
    m.client.mockReturnValue({ from: m.from, auth: { admin: { getUserById: m.authGet } } });
    m.range.mockResolvedValue({ data: [], count: 0, error: null });
  });
  it("requires ADMIN before any service-role query", async () => {
    m.guard.mockRejectedValue(new Error("redirect"));
    for (const load of [getAdminOverview, () => listDeletionRequests(1), () => listClaimsOfficers(1)]) await expect(load()).rejects.toThrow("redirect");
    expect(m.client).not.toHaveBeenCalled();
  });
  it("returns only required request/customer display fields with bounded pagination", async () => {
    m.range.mockResolvedValue({ data: [{ id: "request", status: "PROCESSING", reason: "Demo reason", created_at: "2026-10-01", resolved_at: null, resolution_note: null, user_id: "private-owner", customer: { full_name: "Customer", email: "customer@example.com", auth_user_id: "private-auth" } }], count: 26, error: null });
    const result = await listDeletionRequests(2);
    expect(m.range).toHaveBeenCalledWith(25, 49);
    expect(result.count).toBe(26);
    expect(result.requests[0]).toEqual({ id: "request", status: "PROCESSING", reason: "Demo reason", createdAt: "2026-10-01", resolvedAt: null, resolutionNote: null, customerName: "Customer", customerEmail: "customer@example.com" });
    expect(JSON.stringify(result)).not.toMatch(/private-owner|private-auth|auth_user_id|user_id/);
    expect(m.select.mock.calls[0][0]).not.toContain("*");
  });
  it("uses Auth's current staff email without returning Auth mappings or metadata", async () => {
    m.range.mockResolvedValue({ data: [{ id: "staff", full_name: "Officer", email: "stale@example.com", auth_user_id: "private-auth", created_at: "2026-10-01" }], count: 1, error: null });
    m.authGet.mockResolvedValue({ data: { user: { id: "private-auth", email: "current@example.com", user_metadata: { sensitive: "not-needed" } } }, error: null });
    const result = await listClaimsOfficers(1);
    expect(m.eq).toHaveBeenCalledWith("role", "CLAIMS_OFFICER");
    expect(result.officers).toEqual([{ id: "staff", fullName: "Officer", email: "current@example.com", createdAt: "2026-10-01" }]);
    expect(JSON.stringify(result)).not.toMatch(/private-auth|sensitive|not-needed|stale@example/);
  });
  it("sanitizes provider failures", async () => {
    m.range.mockResolvedValue({ data: null, error: { message: "secret database detail" } });
    expect(JSON.stringify(await listDeletionRequests(1))).not.toContain("secret");
    m.client.mockImplementation(() => { throw new Error("secret provider detail"); });
    expect(await getAdminOverview()).toEqual({ pending: null, officers: null });
  });
  it.each([undefined, "-1", "1.5", "100001", "bad"])("bounds invalid page input %s", input => { expect(adminPageNumber(input)).toBe(1); });
});
