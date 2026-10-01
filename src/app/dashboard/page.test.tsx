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

  it("starts each direct or linked policy card claim with that policy, without changing generic entry", async () => {
    mocks.getCustomerDashboard.mockResolvedValue({
      policies: ["DIRECT", "LINKED"].map((accessType, index) => ({
        id: `11111111-1111-4111-8111-11111111111${index}`,
        policy_number: `MOT-2026-${index}`,
        status: "ACTIVE", coverage_type: "COMPREHENSIVE", accessType,
        start_date: "2026-01-01", end_date: "2027-01-01",
        excess_amount: 150, coverage_limit: 9500, vehicles: null,
      })),
      claims: [], error: null,
    });
    render(await CustomerDashboardPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByRole("link", { name: "Make a claim" }).map((link) => link.getAttribute("href"))).toEqual([
      "/claim?policy=11111111-1111-4111-8111-111111111110",
      "/claim?policy=11111111-1111-4111-8111-111111111111",
    ]);
    for (const link of screen.getAllByRole("link", { name: "Create a new claim" })) {
      expect(link.getAttribute("href")).toBe("/claim");
    }
  });
});
