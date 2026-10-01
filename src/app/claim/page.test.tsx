// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaimPolicyOption } from "@/types/database";

const mocks = vi.hoisted(() => ({
  requireCustomer: vi.fn(),
  getEligibleCustomerClaimPolicies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: mocks.requireCustomer }));
vi.mock("@/lib/claims/customer", () => ({
  getEligibleCustomerClaimPolicies: mocks.getEligibleCustomerClaimPolicies,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import ClaimPage from "@/app/claim/page";

const policyId = "11111111-1111-4111-8111-111111111111";
const eligiblePolicy: ClaimPolicyOption = {
  policyId, policyNumber: "MOT-2026-TOYOTA", coverageType: "COMPREHENSIVE",
  excessAmount: 150, coverageLimit: 9500, status: "ACTIVE", accessType: "DIRECT",
  startDate: "2026-01-01", endDate: "2027-01-01",
  vehicle: { id: "vehicle-1", make: "Toyota", model: "Corolla", year: 2026, plateNumber: "927410" },
};

describe("ClaimPage navigation placement", () => {
  beforeEach(() => {
    mocks.requireCustomer.mockResolvedValue({
      id: "customer-1",
      email: "customer@example.com",
      phone: "+973 3900 0000",
    });
    mocks.getEligibleCustomerClaimPolicies.mockResolvedValue({ policies: [eligiblePolicy], error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("places the page-level dashboard control before the Claim Intake heading", async () => {
    render(await ClaimPage());

    const back = screen.getByRole("link", { name: "Back to dashboard" });
    const heading = screen.getByRole("heading", { name: "Start your motor claim" });
    expect(back.getAttribute("href")).toBe("/dashboard");
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Choose a policy" })).toBeTruthy();
    expect((screen.getByRole("radio") as HTMLInputElement).checked).toBe(false);
  });

  it.each(["DIRECT", "LINKED"] as const)("validates %s entry against the customer's eligible policies and starts at Accident", async (accessType) => {
    mocks.getEligibleCustomerClaimPolicies.mockResolvedValue({ policies: [{ ...eligiblePolicy, accessType }], error: null });
    render(await ClaimPage({ searchParams: Promise.resolve({ policy: policyId }) }));
    expect(mocks.getEligibleCustomerClaimPolicies).toHaveBeenCalledWith("customer-1");
    expect(screen.getByRole("heading", { name: "Accident details" })).toBeTruthy();
    expect(screen.getByText("MOT-2026-TOYOTA")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it("returns policy-detail entry to the exact authorized policy and reconstructs selection on refresh", async () => {
    const searchParams = Promise.resolve({ policy: policyId, from: "policy" });
    const first = render(await ClaimPage({ searchParams }));
    expect(screen.getByRole("link", { name: "Back to policy" }).getAttribute("href")).toBe(`/dashboard/policies/${policyId}`);
    expect(screen.getByRole("heading", { name: "Accident details" })).toBeTruthy();
    first.unmount();
    render(await ClaimPage({ searchParams }));
    expect(screen.getByRole("heading", { name: "Accident details" })).toBeTruthy();
    expect(screen.getByText("MOT-2026-TOYOTA")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to policy" }).getAttribute("href")).toBe(`/dashboard/policies/${policyId}`);
  });

  it("reinitializes intake for a different policy URL during same-route navigation", async () => {
    const linked = { ...eligiblePolicy, policyId: "22222222-2222-4222-8222-222222222222", policyNumber: "MOT-2026-LINKED", accessType: "LINKED" as const };
    mocks.getEligibleCustomerClaimPolicies.mockResolvedValue({ policies: [eligiblePolicy, linked], error: null });
    const view = render(await ClaimPage({ searchParams: Promise.resolve({ policy: policyId }) }));
    expect(screen.getByText("MOT-2026-TOYOTA")).toBeTruthy();
    view.rerender(await ClaimPage({ searchParams: Promise.resolve({ policy: linked.policyId, from: "policy" }) }));
    expect(screen.getByText("MOT-2026-LINKED")).toBeTruthy();
    expect(screen.queryByText("MOT-2026-TOYOTA")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to policy" }).getAttribute("href")).toBe(`/dashboard/policies/${linked.policyId}`);
    view.rerender(await ClaimPage());
    expect(screen.getByRole("heading", { name: "Choose a policy" })).toBeTruthy();
    expect(screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
  });

  it.each([
    undefined, "", "not-a-uuid", "33333333-3333-4333-8333-333333333333",
    [policyId, "33333333-3333-4333-8333-333333333333"],
  ])("falls back safely for missing, malformed, unknown, unauthorized, or ambiguous policy %j", async (policy) => {
    render(await ClaimPage({ searchParams: Promise.resolve({ policy, from: "policy" }) }));
    expect(screen.getByRole("heading", { name: "Choose a policy" })).toBeTruthy();
    expect((screen.getByRole("radio") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it("does not preselect an inaccessible or ineligible policy excluded by the existing loader", async () => {
    mocks.getEligibleCustomerClaimPolicies.mockResolvedValue({ policies: [], error: null });
    render(await ClaimPage({ searchParams: Promise.resolve({ policy: policyId, from: "policy" }) }));
    expect(screen.getByText("No eligible policies found")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Accident details" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it("does not use preselection when loading eligible policies failed", async () => {
    mocks.getEligibleCustomerClaimPolicies.mockResolvedValue({ policies: [], error: "Unable to load your policies right now." });
    render(await ClaimPage({ searchParams: Promise.resolve({ policy: policyId, from: "policy" }) }));
    expect(screen.getByRole("heading", { name: "Choose a policy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it.each(["https://example.com", "/dashboard/policies/another", ["policy", "external"]])("ignores arbitrary or ambiguous origin %j", async (from) => {
    render(await ClaimPage({ searchParams: Promise.resolve({ policy: policyId, from }) }));
    expect(screen.getByRole("heading", { name: "Accident details" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
  });
});
