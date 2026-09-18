import { describe, expect, it, vi } from "vitest";

const { requireCustomerMock } = vi.hoisted(() => ({
  requireCustomerMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireCustomer: requireCustomerMock }));

import DashboardLayout from "@/app/dashboard/layout";

describe("DashboardLayout", () => {
  it("passes the server-authorized customer identity into session synchronization", async () => {
    requireCustomerMock.mockResolvedValue({
      id: "customer",
      auth_user_id: "customer-auth",
      role: "CUSTOMER",
    });

    const result = await DashboardLayout({ children: <p>Customer dashboard</p> });

    expect(requireCustomerMock).toHaveBeenCalledOnce();
    expect(result.props.initialUserId).toBe("customer-auth");
    expect(result.props.initialRole).toBe("CUSTOMER");
    expect(result.props.area).toBe("customer");
    expect(result.props.children.props.children).toBe("Customer dashboard");
  });

  it("does not swallow staff or unauthenticated redirects", async () => {
    requireCustomerMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(DashboardLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT");
  });
});
