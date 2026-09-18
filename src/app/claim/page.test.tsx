// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCustomer: vi.fn(),
  getEligibleCustomerClaimPolicies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: mocks.requireCustomer }));
vi.mock("@/lib/claims/customer", () => ({
  getEligibleCustomerClaimPolicies: mocks.getEligibleCustomerClaimPolicies,
}));
vi.mock("@/components/claim/ClaimWizard", () => ({
  ClaimWizard: () => <div data-testid="claim-wizard">Claim wizard</div>,
}));

import ClaimPage from "@/app/claim/page";

describe("ClaimPage navigation placement", () => {
  beforeEach(() => {
    mocks.requireCustomer.mockResolvedValue({
      id: "customer-1",
      email: "customer@example.com",
      phone: "+973 3900 0000",
    });
    mocks.getEligibleCustomerClaimPolicies.mockResolvedValue({ policies: [], error: null });
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
    expect(screen.getByTestId("claim-wizard")).toBeTruthy();
  });
});
