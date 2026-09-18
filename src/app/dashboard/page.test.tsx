// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCustomer: vi.fn(),
  getCustomerDashboard: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: mocks.requireCustomer }));
vi.mock("@/lib/claims/customer", () => ({ getCustomerDashboard: mocks.getCustomerDashboard }));
vi.mock("@/components/dashboard/PolicyAccessControl", () => ({ PolicyAccessControl: () => null }));

import CustomerDashboardPage from "@/app/dashboard/page";

describe("CustomerDashboardPage navigation", () => {
  beforeEach(() => {
    mocks.requireCustomer.mockResolvedValue({ id: "customer-1", full_name: "Mohammed" });
    mocks.getCustomerDashboard.mockResolvedValue({ policies: [], claims: [], error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps claim entry actions without showing an inner-page back control", async () => {
    render(await CustomerDashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Welcome, Mohammed" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Back to dashboard" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Create a new claim" })[0]?.getAttribute("href")).toBe("/claim");
  });
});
