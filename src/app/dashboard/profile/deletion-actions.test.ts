import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customer: vi.fn(), client: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn(),
  select: vi.fn(), eq: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(),
  sendEmail: vi.fn(), revalidate: vi.fn(), remove: vi.fn(), deleteUser: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCustomerForApi: mocks.customer }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: mocks.client }));
vi.mock("@/lib/privacy/emails", () => ({ sendDataDeletionRequestEmail: mocks.sendEmail }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { submitDataDeletionRequestAction, cancelDataDeletionRequestAction } from "./deletion-actions";

const id = "98ad912f-7c76-48b4-8b4d-a0805beeb002";
const row = { id, status: "PENDING", created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", resolved_at: null };
function form(reason = "", acknowledged = true) {
  const data = new FormData(); data.set("reason", reason);
  if (acknowledged) data.set("acknowledged", "on");
  data.set("userId", "another-customer"); data.set("email", "attacker@example.com");
  return data;
}
function cancellation(confirmed = true) {
  const data = new FormData(); data.set("requestId", id);
  if (confirmed) data.set("confirmed", "on");
  data.set("userId", "another-customer"); return data;
}

describe("data deletion request actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customer.mockResolvedValue({ id: "authenticated-customer", role: "CUSTOMER", full_name: "Customer Name", email: "verified@example.com" });
    const query = { insert: mocks.insert, update: mocks.update, select: mocks.select, eq: mocks.eq, single: mocks.single, maybeSingle: mocks.maybeSingle, delete: mocks.remove };
    mocks.client.mockReturnValue({ from: mocks.from, auth: { admin: { deleteUser: mocks.deleteUser } } });
    for (const method of [mocks.from, mocks.insert, mocks.update, mocks.select, mocks.eq]) method.mockReturnValue(query);
    mocks.single.mockResolvedValue({ data: row, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { ...row, status: "CANCELLED", resolved_at: "2026-10-01T13:00:00Z", updated_at: "2026-10-01T13:00:00Z" }, error: null });
    mocks.sendEmail.mockResolvedValue(true);
  });

  it("records a request for the session customer only, without deleting any records", async () => {
    const result = await submitDataDeletionRequestAction({}, form("  Please review my demo data.  "));
    expect(result.outcome).toBe("received");
    expect(result.request?.status).toBe("PENDING");
    expect(mocks.insert).toHaveBeenCalledWith({ user_id: "authenticated-customer", status: "PENDING", reason: "Please review my demo data." });
    expect(mocks.from).toHaveBeenCalledWith("data_deletion_requests");
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.sendEmail).toHaveBeenCalledWith({ recipient: "verified@example.com", customerName: "Customer Name", requestId: id });
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard/profile");
    expect(JSON.stringify(result)).not.toMatch(/user_id|verified@example|reason|resolution_note/);
  });

  it("accepts an omitted or whitespace-only optional reason as null", async () => {
    await submitDataDeletionRequestAction({}, form("   "));
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ reason: null }));
    const missing = form(); missing.delete("reason");
    expect((await submitDataDeletionRequestAction({}, missing)).outcome).toBe("received");
  });

  it.each([null, { id: "staff", role: "CLAIMS_OFFICER" }, { id: "admin", role: "ADMIN" }])("rejects unauthenticated or noncustomer submission and cancellation: %j", async (profile) => {
    mocks.customer.mockResolvedValue(profile);
    expect((await submitDataDeletionRequestAction({}, form())).outcome).toBeUndefined();
    expect((await cancelDataDeletionRequestAction({}, cancellation())).outcome).toBeUndefined();
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("requires explicit acknowledgement on the server", async () => {
    expect((await submitDataDeletionRequestAction({}, form("", false))).fields?.acknowledged).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects oversized reasons and file values safely", async () => {
    expect((await submitDataDeletionRequestAction({}, form("x".repeat(1001)))).fields?.reason).toBeTruthy();
    const invalid = form(); invalid.set("reason", new Blob(["secret"]), "upload.txt");
    expect((await submitDataDeletionRequestAction({}, invalid)).fields?.reason).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("handles the unique pending constraint without resending email", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "23505", message: "internal constraint detail" } });
    const result = await submitDataDeletionRequestAction({}, form());
    expect(result.message).toBe("A data deletion request is already pending.");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard/profile");
  });

  it.each([false, "throws"])("keeps the request successful when email delivery %s", async (failure) => {
    if (failure === "throws") mocks.sendEmail.mockRejectedValue(new Error("private provider error"));
    else mocks.sendEmail.mockResolvedValue(false);
    const result = await submitDataDeletionRequestAction({}, form());
    expect(result.outcome).toBe("received"); expect(result.emailSent).toBe(false);
    expect(result.request?.status).toBe("PENDING");
    expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private provider");
  });

  it("cancels only the customer's explicitly selected pending request", async () => {
    const result = await cancelDataDeletionRequestAction({}, cancellation());
    expect(result.outcome).toBe("cancelled"); expect(result.request?.status).toBe("CANCELLED");
    expect(mocks.eq.mock.calls).toEqual([["id", id], ["user_id", "authenticated-customer"], ["status", "PENDING"]]);
    const update = mocks.update.mock.calls[0][0];
    expect(update.status).toBe("CANCELLED"); expect(update.updated_at).toBe(update.resolved_at);
    expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it.each(["another customer's", "completed", "rejected", "already cancelled"])("cannot cancel a %s request", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await cancelDataDeletionRequestAction({}, cancellation())).outcome).toBeUndefined();
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "authenticated-customer");
    expect(mocks.eq).toHaveBeenCalledWith("status", "PENDING");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("rejects unconfirmed cancellation and malformed references before database access", async () => {
    expect((await cancelDataDeletionRequestAction({}, cancellation(false))).message).toMatch(/confirm/i);
    const invalid = cancellation(); invalid.set("requestId", "bad-id");
    expect((await cancelDataDeletionRequestAction({}, invalid)).message).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("sanitizes database failures without sending email", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "DATABASE_ERROR", message: "secret infrastructure" } });
    const result = await submitDataDeletionRequestAction({}, form());
    expect(result.message).toMatch(/could not/i); expect(JSON.stringify(result)).not.toContain("secret infrastructure");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
