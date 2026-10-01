import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ admin: vi.fn(), client: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), update: vi.fn(), single: vi.fn(), authUpdate: vi.fn(), authGet: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin", () => ({ getAdminForApi: m.admin }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: m.client }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { transitionDeletionRequestAction, updateClaimsOfficerAction } from "./management-actions";
const id = "98ad912f-7c76-48b4-8b4d-a0805beeb002";
const authId = "78ad912f-7c76-48b4-8b4d-a0805beeb002";
function data(values: Record<string, string | undefined>) { const f = new FormData(); Object.entries(values).forEach(([key, value]) => { if (value !== undefined) f.set(key, value); }); return f; }
describe("ADMIN management mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.admin.mockResolvedValue({ role: "ADMIN" });
    const q = { select: m.select, eq: m.eq, update: m.update, maybeSingle: m.single };
    for (const fn of [m.from, m.select, m.eq, m.update]) fn.mockReturnValue(q);
    m.client.mockReturnValue({ from: m.from, auth: { admin: { updateUserById: m.authUpdate, getUserById: m.authGet } } });
    m.single.mockResolvedValue({ data: { id }, error: null });
    m.authGet.mockResolvedValue({ data: { user: { id: authId, email: "old@example.com", email_confirmed_at: "2026-01-01" } }, error: null });
    m.authUpdate.mockResolvedValue({ data: { user: { id: authId, email: "new@example.com" } }, error: null });
  });
  it.each(["process", "reject", "complete"])("enforces the source state for %s and updates resolution metadata", async (action) => {
    const result = await transitionDeletionRequestAction({}, data({ requestId: id, action, note: "Reviewed as a demonstration request.", confirmed: "on", userId: "attacker" }));
    expect(result.success).toBe(true);
    expect(m.eq).toHaveBeenCalledWith("id", id);
    expect(m.eq).toHaveBeenCalledWith("status", action === "complete" ? "PROCESSING" : "PENDING");
    const write = m.update.mock.calls[0][0];
    expect(write.status).toBe({ process: "PROCESSING", reject: "REJECTED", complete: "COMPLETED" }[action]);
    expect(write.resolved_at).toBe(action === "process" ? null : write.updated_at);
    expect(write.resolution_note).toBe(action === "process" ? null : "Reviewed as a demonstration request.");
    expect(m.from).toHaveBeenCalledTimes(1); expect(m.from).toHaveBeenCalledWith("data_deletion_requests");
    expect(m.authUpdate).not.toHaveBeenCalled();
  });
  it("rejects invalid/stale transitions without claiming success", async () => {
    m.single.mockResolvedValue({ data: null, error: null });
    expect((await transitionDeletionRequestAction({}, data({ requestId: id, action: "process", confirmed: "on" }))).success).toBeUndefined();
  });
  it("requires confirmation and a rejection note", async () => {
    for (const values of [{ action: "process" }, { action: "reject", confirmed: "on" }, { action: "delete", confirmed: "on" }]) {
      expect((await transitionDeletionRequestAction({}, data({ requestId: id, ...values }))).success).toBeUndefined();
    }
    expect(m.update).not.toHaveBeenCalled();
  });
  it.each([null, { role: "CLAIMS_OFFICER" }, { role: "CUSTOMER" }])("rejects non-admin mutations %j", async (actor) => {
    m.admin.mockResolvedValue(actor);
    expect((await transitionDeletionRequestAction({}, data({ requestId: id, action: "process", confirmed: "on" }))).success).toBeUndefined();
    expect((await updateClaimsOfficerAction({}, data({ staffId: id, fullName: "Staff", email: "new@example.com", confirmed: "on" }))).success).toBeUndefined();
    expect(m.client).not.toHaveBeenCalled();
  });
  it("updates only organization-managed staff name/email, with the target Auth identity resolved server-side", async () => {
    m.single.mockResolvedValueOnce({ data: { id, auth_user_id: authId, full_name: "Old Name", email: "old@example.com", role: "CLAIMS_OFFICER" }, error: null }).mockResolvedValueOnce({ data: { id }, error: null });
    const result = await updateClaimsOfficerAction({}, data({ staffId: id, fullName: "  O’Connor 李  ", email: " NEW@example.com ", confirmed: "on", authUserId: "attacker", role: "ADMIN", password: "must-not-forward" }));
    expect(result.success).toBe(true);
    expect(m.eq).toHaveBeenCalledWith("role", "CLAIMS_OFFICER");
    expect(m.authUpdate).toHaveBeenCalledWith(authId, { email: "new@example.com", email_confirm: true, user_metadata: { full_name: "O’Connor 李" } });
    expect(m.update).toHaveBeenCalledWith({ full_name: "O’Connor 李", email: "new@example.com" });
    expect(JSON.stringify(result)).not.toMatch(/auth_user_id|attacker|password/);
  });
  it("does not update a customer/admin or missing staff mapping", async () => {
    m.single.mockResolvedValue({ data: null, error: null });
    expect((await updateClaimsOfficerAction({}, data({ staffId: id, fullName: "Staff", email: "new@example.com", confirmed: "on" }))).success).toBeUndefined();
    expect(m.authUpdate).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it("keeps the profile email unchanged when Auth rejects a conflicting email", async () => {
    m.single.mockResolvedValue({ data: { id, auth_user_id: authId, full_name: "Staff", email: "old@example.com", role: "CLAIMS_OFFICER" }, error: null });
    m.authUpdate.mockResolvedValue({ data: { user: null }, error: { message: "raw provider account detail" } });
    const result = await updateClaimsOfficerAction({}, data({ staffId: id, fullName: "Staff", email: "new@example.com", confirmed: "on" }));
    expect(result.success).toBeUndefined(); expect(m.update).not.toHaveBeenCalled(); expect(result.message).not.toContain("provider");
  });
  it("keeps an authoritative name update successful if secondary Auth metadata sync fails", async () => {
    m.single.mockResolvedValueOnce({ data: { id, auth_user_id: authId, role: "CLAIMS_OFFICER" }, error: null }).mockResolvedValueOnce({ data: { id }, error: null });
    m.authUpdate.mockResolvedValue({ data: { user: null }, error: { message: "private" } });
    const result = await updateClaimsOfficerAction({}, data({ staffId: id, fullName: "New Staff Name", email: "old@example.com", confirmed: "on" }));
    expect(result.success).toBe(true);
    expect(m.update).toHaveBeenCalledWith({ full_name: "New Staff Name", email: "old@example.com" });
    expect(m.authUpdate).toHaveBeenCalledWith(authId, { user_metadata: { full_name: "New Staff Name" } });
    expect(m.update.mock.invocationCallOrder[0]).toBeLessThan(m.authUpdate.mock.invocationCallOrder[0]);
  });
  it("reports a partial profile failure after an Auth email change without claiming full success", async () => {
    m.single.mockResolvedValueOnce({ data: { id, auth_user_id: authId, role: "CLAIMS_OFFICER" }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "private" } });
    const result = await updateClaimsOfficerAction({}, data({ staffId: id, fullName: "Staff", email: "new@example.com", confirmed: "on" }));
    expect(result.success).toBeUndefined();
    expect(result.message).toContain("work email changed");
    expect(result.message).not.toContain("private");
    expect(m.authUpdate).toHaveBeenCalledTimes(1);
  });
});
