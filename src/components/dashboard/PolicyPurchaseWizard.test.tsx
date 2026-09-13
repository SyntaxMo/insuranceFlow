// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDemoPolicyQuoteMock, issueDemoPolicyMock } = vi.hoisted(() => ({
  getDemoPolicyQuoteMock: vi.fn(),
  issueDemoPolicyMock: vi.fn(async (state) => state),
}));

vi.mock("@/app/dashboard/policies/new/actions", () => ({
  getDemoPolicyQuote: getDemoPolicyQuoteMock,
  issueDemoPolicy: issueDemoPolicyMock,
}));

import { PolicyPurchaseWizard } from "@/components/dashboard/PolicyPurchaseWizard";

async function reachCoverageStep() {
  const user = userEvent.setup();
  render(<PolicyPurchaseWizard customer={{ fullName: "Maya Ali", email: "maya@example.com" }} requestId="22087e7d-4c89-4b10-9620-ec8c525b0718" />);
  await user.type(screen.getByLabelText("Make"), "Toyota");
  await user.type(screen.getByLabelText("Model"), "Corolla");
  await user.type(screen.getByLabelText("Plate number"), "927410");
  await user.type(screen.getByLabelText("Estimated vehicle value"), "9500");
  await user.click(screen.getByRole("button", { name: "Continue to coverage" }));
  return user;
}

async function reachReviewStep() {
  const user = await reachCoverageStep();
  await user.click(screen.getByRole("button", { name: "Comprehensive coverage" }));
  await user.click(screen.getByRole("button", { name: "See your quote" }));
  await screen.findByRole("heading", { name: "Your annual quote" });
  await user.click(screen.getByRole("button", { name: "Review details" }));
  return user;
}

describe("PolicyPurchaseWizard presentation", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    getDemoPolicyQuoteMock.mockResolvedValue({
      ok: true,
      quote: {
        coverage: "COMPREHENSIVE",
        coverageLabel: "COMPREHENSIVE",
        annualPremium: 171,
        excess: 150,
        coverageLimit: 9500,
        vehicleAge: 0,
        adjustmentLabel: "1.00×",
      },
      startDate: "2026-09-13",
      endDate: "2027-09-12",
    });
  });

  it("communicates coverage selection with text and aria state", async () => {
    const user = await reachCoverageStep();
    const option = screen.getByRole("button", { name: "Comprehensive coverage" });

    expect(option.getAttribute("aria-pressed")).toBe("false");
    await user.click(option);

    expect(option.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Selected")).toBeTruthy();
  });

  it("shows customer-friendly quote explanation and formatted coverage", async () => {
    const user = await reachCoverageStep();
    await user.click(screen.getByRole("button", { name: "Comprehensive coverage" }));
    await user.click(screen.getByRole("button", { name: "See your quote" }));

    expect(await screen.findByRole("heading", { name: "Your annual quote" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Annual premium summary" })).toBeTruthy();
    expect(screen.getByText("For 12 months")).toBeTruthy();
    expect(screen.getAllByText("Comprehensive").length).toBeGreaterThan(0);
    expect(screen.getByText("Your quote is based on the selected coverage, estimated vehicle value, and vehicle age.")).toBeTruthy();
    expect(screen.getByText("These are demonstration pricing rules and are not real insurance underwriting rates.")).toBeTruthy();
    expect(screen.queryByText(/published demonstration rules/i)).toBeNull();
  });

  it("requires consent before payment and keeps legal pages in new tabs", async () => {
    const user = await reachReviewStep();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    const continueButton = screen.getByRole("button", { name: "Continue to payment" }) as HTMLButtonElement;
    expect(checkbox.checked).toBe(false);
    expect(continueButton.disabled).toBe(true);
    expect(screen.getByTestId("purchase-consent-control").className).toContain("border-slate-400");

    const terms = screen.getByRole("link", { name: "Terms & Conditions" });
    expect(terms.getAttribute("href")).toBe("/terms");
    expect(terms.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: "Insurance & Demo Disclaimer" }).getAttribute("target")).toBe("_blank");

    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(screen.getByTestId("purchase-consent-control").className).toContain("bg-[var(--brand-teal)]");
    expect(continueButton.disabled).toBe(false);
    await user.click(continueButton);
    expect(screen.getByRole("heading", { name: "Payment" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});
