import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => ({ from: mocks.from }) }));
import { getCustomerDataDeletionRequest } from "./data-deletion";
describe("customer deletion request status loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = { select: mocks.select, eq: mocks.eq, order: mocks.order, limit: mocks.limit, maybeSingle: mocks.maybeSingle };
    for (const method of [mocks.from, mocks.select, mocks.eq, mocks.order, mocks.limit]) method.mockReturnValue(query);
  });

  it.each(["PENDING", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"])("loads the latest owned %s status without reason or internal notes", async (status) => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "request", status, created_at: "2026-10-01", updated_at: "2026-10-02", resolved_at: null, user_id: "owner", reason: "sensitive reason", resolution_note: "private maintenance note" }, error: null });
    const result = await getCustomerDataDeletionRequest("session-customer");
    expect(result).toEqual({ request: { id: "request", status, createdAt: "2026-10-01", updatedAt: "2026-10-02", resolvedAt: null }, unavailable: false });
    expect(mocks.select).toHaveBeenCalledWith("id, status, created_at, updated_at, resolved_at");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "session-customer");
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("distinguishes no request from unavailable status", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getCustomerDataDeletionRequest("session-customer")).toEqual({ request: null, unavailable: false });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: "DATABASE_ERROR", message: "private error" } });
    expect(await getCustomerDataDeletionRequest("session-customer")).toEqual({ request: null, unavailable: true });
  });
});
