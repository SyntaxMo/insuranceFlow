// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCustomerClaimDetailsMock, requireCustomerMock } = vi.hoisted(() => ({
  getCustomerClaimDetailsMock: vi.fn(),
  requireCustomerMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: requireCustomerMock }));
vi.mock("@/lib/claims/customer", () => ({
  getCustomerClaimDetails: getCustomerClaimDetailsMock,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import CustomerClaimPage from "@/app/dashboard/claims/[id]/page";

const claim = {
  id: "claim-1",
  claim_number: "CLM-2026-0001",
  status: "UNDER_REVIEW",
  accident_date: "2026-09-10",
  accident_location: "Manama",
  description: "Rear collision",
  created_at: "2026-09-11T10:00:00Z",
  policyNumber: "MOT-2026-0001",
  vehicle: { make: "Toyota", model: "Corolla", year: 2026, plate_number: "927410" },
  latestInformationRequest: null,
  rejectionReason: null,
  history: [
    {
      id: "history-1",
      claim_id: "claim-1",
      from_status: "MORE_INFO_REQUIRED",
      to_status: "UNDER_REVIEW",
      action: "CUSTOMER_INFO_SUBMITTED",
      note: "Documents supplied",
      actor_user_id: null,
      actor_role: "CUSTOMER",
      created_at: "2026-09-12T10:00:00Z",
    },
  ],
};

describe("CustomerClaimPage response success feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomerMock.mockResolvedValue({ id: "customer-1", role: "CUSTOMER" });
    getCustomerClaimDetailsMock.mockResolvedValue({ claim, error: null });
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("shows confirmed feedback with the updated status and history", async () => {
    window.history.replaceState({}, "", "/dashboard/claims/claim-1?submitted=1");
    render(await CustomerClaimPage({
      params: Promise.resolve({ id: "claim-1" }),
      searchParams: Promise.resolve({ submitted: "1" }),
    }));

    expect(screen.getByRole("status").textContent).toContain("Information submitted successfully");
    expect(screen.getByRole("link", { name: "← Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByText(/^Under review$/i)).toBeTruthy();
    expect(screen.getByText("Customer submitted additional information")).toBeTruthy();
  });

  it("does not show stale feedback on a normal claim visit", async () => {
    render(await CustomerClaimPage({
      params: Promise.resolve({ id: "claim-1" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.queryByText("Information submitted successfully")).toBeNull();
    expect(screen.getByText(/^Under review$/i)).toBeTruthy();
  });
});
