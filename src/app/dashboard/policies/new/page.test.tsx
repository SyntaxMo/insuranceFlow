// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireCustomerMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: requireCustomerMock }));
vi.mock("@/components/dashboard/PolicyPurchaseWizard", () => ({
  PolicyPurchaseWizard: () => <div data-testid="policy-purchase-wizard">Policy purchase wizard</div>,
}));

import NewPolicyPage, { metadata } from "@/app/dashboard/policies/new/page";

describe("NewPolicyPage layout", () => {
  beforeEach(() => {
    requireCustomerMock.mockResolvedValue({
      full_name: "Mohammed Essam",
      email: "mohammed@example.com",
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the Claim Intake workflow shell without changing the purchase wizard", async () => {
    const view = render(<main>{await NewPolicyPage()}</main>);

    const back = screen.getByRole("link", { name: "Back to dashboard" });
    const heading = screen.getByRole("heading", { name: "Get a motor policy" });
    const pageContainer = view.container.querySelector("main")?.firstElementChild;
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(metadata.title).toBe("Get a motor policy | InsureFlow");

    expect(back.getAttribute("href")).toBe("/dashboard");
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pageContainer?.className).toContain("max-w-3xl");
    expect(pageContainer?.className).toContain("py-10");
    expect(screen.getByText("Motor insurance")).toBeTruthy();
    expect(screen.getByText(/Build a deterministic demonstration quote/)).toBeTruthy();
    expect(screen.getByTestId("policy-purchase-wizard")).toBeTruthy();
  });
});
