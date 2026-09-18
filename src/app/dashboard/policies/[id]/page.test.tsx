// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireCustomerMock, getCustomerPolicyDetailsMock, getPolicyDocumentMetadataMock } = vi.hoisted(() => ({
  requireCustomerMock: vi.fn(),
  getCustomerPolicyDetailsMock: vi.fn(),
  getPolicyDocumentMetadataMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: requireCustomerMock }));
vi.mock("@/lib/claims/customer", () => ({ getCustomerPolicyDetails: getCustomerPolicyDetailsMock }));
vi.mock("@/lib/policies/policy-document-delivery", () => ({ getPolicyDocumentMetadata: getPolicyDocumentMetadataMock }));
vi.mock("@/components/dashboard/PolicyAccessControl", () => ({ PolicyAccessControl: () => <span>Policy management</span> }));

import CustomerPolicyPage from "@/app/dashboard/policies/[id]/page";

const policyId = "8f000000-0000-4000-8000-000000000002";
const basePolicy = {
  id: policyId,
  user_id: "portal-user",
  policy_number: "MOT-2026-D95F565D",
  status: "ACTIVE",
  coverage_type: "COMPREHENSIVE",
  start_date: "2026-09-13",
  end_date: "2027-09-12",
  excess_amount: 150,
  coverage_limit: 9500,
  annual_premium: 171,
  purchase_request_id: "22087e7d-4c89-4b10-9620-ec8c525b0718",
  vehicles: { make: "Toyota", model: "Corolla", year: 2026, plate_number: "927410", vin: null },
};

describe("customer policy document action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomerMock.mockResolvedValue({ id: "portal-user", role: "CUSTOMER" });
  });
  afterEach(cleanup);

  it("shows Download policy for an authorized policy with document metadata", async () => {
    getCustomerPolicyDetailsMock.mockResolvedValue({ policy: { ...basePolicy, accessType: "DIRECT" }, error: null });
    getPolicyDocumentMetadataMock.mockResolvedValue({ file_name: "InsureFlow-MOT-2026-D95F565D.pdf" });
    render(await CustomerPolicyPage({ params: Promise.resolve({ id: policyId }) }));

    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByText("← Back to dashboard")).toBeNull();
    const download = screen.getByRole("link", { name: "Download policy MOT-2026-D95F565D" });
    expect(download.getAttribute("href")).toBe(`/dashboard/policies/${policyId}/document`);
  });

  it("keeps a linked policy without a generated document functional and hides the action", async () => {
    getCustomerPolicyDetailsMock.mockResolvedValue({ policy: { ...basePolicy, user_id: "seeded-owner", purchase_request_id: null, accessType: "LINKED" }, error: null });
    getPolicyDocumentMetadataMock.mockResolvedValue(null);
    render(await CustomerPolicyPage({ params: Promise.resolve({ id: policyId }) }));

    expect(screen.getByRole("heading", { name: "Toyota Corolla (2026)" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Download policy/ })).toBeNull();
    expect(screen.getByText("Policy management")).toBeTruthy();
  });
});
