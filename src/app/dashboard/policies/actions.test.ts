import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCustomerMock, unlinkCustomerPolicyMock, revalidatePathMock, redirectMock } =
  vi.hoisted(() => ({
    requireCustomerMock: vi.fn(),
    unlinkCustomerPolicyMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
  }));

vi.mock("@/lib/auth/session", () => ({ requireCustomer: requireCustomerMock }));
vi.mock("@/lib/policies/unlink", () => ({
  unlinkCustomerPolicy: unlinkCustomerPolicyMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { removeLinkedPolicyAction } from "@/app/dashboard/policies/actions";

const policyId = "2d0c1577-f1b2-4bf7-8b65-e8c23295d071";

function data() {
  const value = new FormData();
  value.set("policyId", policyId);
  return value;
}

describe("removeLinkedPolicyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomerMock.mockResolvedValue({ id: "authenticated-portal-user" });
  });

  it("derives the portal user from the authenticated profile", async () => {
    unlinkCustomerPolicyMock.mockResolvedValue({ ok: true });

    await expect(removeLinkedPolicyAction({}, data())).rejects.toThrow("NEXT_REDIRECT");

    expect(unlinkCustomerPolicyMock).toHaveBeenCalledWith({
      portalUserId: "authenticated-portal-user",
      policyId,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard?policyRemoved=1");
  });

  it("shows the required active-claim error without redirecting", async () => {
    unlinkCustomerPolicyMock.mockResolvedValue({ ok: false, reason: "active_claim" });

    const result = await removeLinkedPolicyAction({}, data());

    expect(result.message).toBe(
      "This policy cannot be removed while it has an active claim.",
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not call the data layer if authentication fails", async () => {
    requireCustomerMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(removeLinkedPolicyAction({}, data())).rejects.toThrow("NEXT_REDIRECT");
    expect(unlinkCustomerPolicyMock).not.toHaveBeenCalled();
  });
});
