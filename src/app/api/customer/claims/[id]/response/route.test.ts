import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCustomerForApiMock, submitCustomerClaimResponseMock, revalidatePathMock } = vi.hoisted(() => ({
  getCustomerForApiMock: vi.fn(),
  submitCustomerClaimResponseMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCustomerForApi: getCustomerForApiMock }));
vi.mock("@/lib/claims/workflow-server", () => ({ submitCustomerClaimResponse: submitCustomerClaimResponseMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { POST } from "@/app/api/customer/claims/[id]/response/route";

function request() {
  const form = new FormData();
  form.set("responseMessage", "Here is the requested information.");
  return new Request("http://localhost/api/customer/claims/claim-1/response", { method: "POST", body: form });
}

describe("customer claim response route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomerForApiMock.mockResolvedValue({ id: "customer-1", role: "CUSTOMER" });
    submitCustomerClaimResponseMock.mockResolvedValue({ ok: true });
  });

  it("requires an authenticated customer", async () => {
    getCustomerForApiMock.mockResolvedValue(null);
    const response = await POST(request(), { params: Promise.resolve({ id: "claim-1" }) });
    expect(response.status).toBe(401);
    expect(submitCustomerClaimResponseMock).not.toHaveBeenCalled();
  });

  it("passes the server-derived customer to the secured response service", async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: "claim-1" }) });
    expect(response.status).toBe(200);
    expect(submitCustomerClaimResponseMock).toHaveBeenCalledWith(expect.objectContaining({
      claimId: "claim-1",
      customer: expect.objectContaining({ id: "customer-1" }),
      formData: expect.any(FormData),
    }));
  });
});
