// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCustomer: vi.fn(),
  getCustomerAccountSummary: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: mocks.requireCustomer }));
vi.mock("@/lib/claims/customer", () => ({
  getCustomerAccountSummary: mocks.getCustomerAccountSummary,
}));

import CustomerProfilePage from "@/app/dashboard/profile/page";

const customer = {
  id: "current-customer-id",
  auth_user_id: "current-auth-id",
  full_name: "Mohammed Essam",
  email: "mohammed@example.com",
  phone: "+973 3900 0000",
  role: "CUSTOMER" as const,
  created_at: "2025-04-12T09:00:00.000Z",
};

describe("CustomerProfilePage", () => {
  beforeEach(() => {
    mocks.requireCustomer.mockResolvedValue(customer);
    mocks.getCustomerAccountSummary.mockResolvedValue({
      summary: { activePolicies: 2, openClaims: 1, totalClaims: 3 },
      error: null,
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the authenticated customer's persisted profile and account summary", async () => {
    render(await CustomerProfilePage());

    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("heading", { name: "Your profile" })).toBeTruthy();
    const avatar = screen.getByTestId("profile-page-avatar");
    expect(avatar.querySelector('[data-testid="default-profile-icon"]')).toBeTruthy();
    expect(avatar.textContent).toBe("");
    expect(screen.getByText("Mohammed Essam")).toBeTruthy();
    expect(screen.getByText("mohammed@example.com")).toBeTruthy();
    expect(screen.getByText("+973 3900 0000")).toBeTruthy();
    expect(screen.getByText("Apr 12, 2025")).toBeTruthy();
    expect(screen.getByText("Active policies").nextElementSibling?.textContent).toBe("2");
    expect(screen.getByText("Open claims").nextElementSibling?.textContent).toBe("1");
    expect(screen.getByText("Total claims").nextElementSibling?.textContent).toBe("3");
    expect(mocks.getCustomerAccountSummary).toHaveBeenCalledWith("current-customer-id");
  });

  it("renders missing optional phone information cleanly", async () => {
    mocks.requireCustomer.mockResolvedValue({ ...customer, phone: null });
    render(await CustomerProfilePage());
    expect(screen.getByText("Not provided")).toBeTruthy();
  });

  it.each([
    ["an unauthenticated visitor", "/login"],
    ["a Claims Officer", "/admin"],
    ["an Administrator", "/admin"],
  ])("does not render for %s when the established customer guard redirects", async (_label, destination) => {
    mocks.requireCustomer.mockRejectedValueOnce(new Error(`NEXT_REDIRECT:${destination}`));
    await expect(CustomerProfilePage()).rejects.toThrow(`NEXT_REDIRECT:${destination}`);
    expect(mocks.getCustomerAccountSummary).not.toHaveBeenCalled();
  });

  it("has no browser-supplied identity input and scopes all summary data to the authenticated profile", async () => {
    await CustomerProfilePage();
    expect(mocks.requireCustomer).toHaveBeenCalledWith();
    expect(mocks.getCustomerAccountSummary).toHaveBeenCalledWith("current-customer-id");
  });

  it("shows a safe account-activity message without exposing data errors", async () => {
    mocks.getCustomerAccountSummary.mockResolvedValue({
      summary: null,
      error: "database table unavailable",
    });
    render(await CustomerProfilePage());
    expect(screen.getByText(/Account activity is temporarily unavailable/)).toBeTruthy();
    expect(screen.queryByText(/database table unavailable/)).toBeNull();
  });

  it("links to the existing legal pages without unfinished account controls", async () => {
    render(await CustomerProfilePage());
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Disclaimer" }).getAttribute("href")).toBe("/disclaimer");
    expect(screen.queryByRole("button", { name: /change|delete/i })).toBeNull();
  });
});
