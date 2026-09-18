import { describe, expect, it, vi } from "vitest";

const { requireCustomerMock } = vi.hoisted(() => ({
  requireCustomerMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireCustomer: requireCustomerMock }));

import ClaimLayout from "@/app/claim/layout";

describe("ClaimLayout", () => {
  it("protects customer claim pages with the current auth identity", async () => {
    requireCustomerMock.mockResolvedValue({
      id: "customer",
      auth_user_id: "customer-auth",
      role: "CUSTOMER",
    });

    const result = await ClaimLayout({ children: <p>New claim</p> });

    expect(requireCustomerMock).toHaveBeenCalledOnce();
    expect(result.props.initialUserId).toBe("customer-auth");
    expect(result.props.initialRole).toBe("CUSTOMER");
    expect(result.props.area).toBe("customer");
  });

  it("keeps server-side redirects authoritative", async () => {
    requireCustomerMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(ClaimLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT");
  });
});
