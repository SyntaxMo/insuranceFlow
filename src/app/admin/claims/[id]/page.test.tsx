// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClaimDetailView } from "@/types/database";

const mocks = vi.hoisted(() => ({ getClaimById: vi.fn() }));
vi.mock("@/lib/claims/admin", () => ({ getClaimById: mocks.getClaimById }));
vi.mock("@/lib/ai/analyze-claim", () => ({ loadClaimAnalysis: async () => ({ analysis: null }) }));
vi.mock("@/components/admin/AiClaimAnalysis", () => ({ AiClaimAnalysis: () => null }));
vi.mock("@/components/admin/ClaimOfficerActions", () => ({ ClaimOfficerActions: () => null }));

import AdminClaimDetailPage from "@/app/admin/claims/[id]/page";

const claim: ClaimDetailView = {
  id: "claim-1", claimNumber: "CLM-2026-001", status: "UNDER_REVIEW",
  createdAt: "2026-09-16T10:00:00Z", accidentDate: "2026-09-15",
  accidentLocation: "Manama", description: "Rear impact",
  customerName: "Demo Customer", email: "demo@example.com", phone: "39000000",
  policyStatus: "ACTIVE", annualPremium: 171,
  policy: {
    policyId: "policy-1", policyNumber: "MOT-1", coverageType: "COMPREHENSIVE",
    excessAmount: 150, coverageLimit: 9500, startDate: "2026-01-01", endDate: "2027-01-01",
    vehicle: { id: "vehicle-1", make: "Toyota", model: "Corolla", year: 2026, plateNumber: "927410" },
  },
  documents: [
    { id: "photo-1", documentType: "ACCIDENT_PHOTO", fileName: "rear-damage.jpg", mimeType: "image/jpeg", storagePath: "private/path/rear.jpg", signedUrl: null },
    { id: "report-1", documentType: "POLICE_REPORT", fileName: "report.pdf", mimeType: "application/pdf", storagePath: "private/path/report.pdf", signedUrl: null },
    { id: "photo-2", documentType: "ADDITIONAL_INFORMATION", fileName: "follow-up.jpg", mimeType: "image/jpeg", storagePath: "private/path/follow-up.jpg", signedUrl: null },
  ],
  history: [],
};

describe("officer evidence accessibility", () => {
  afterEach(cleanup);

  it("gives evidence previews useful context and each document action a specific accessible name", async () => {
    mocks.getClaimById.mockResolvedValue({ claim, error: null });
    const { container } = render(await AdminClaimDetailPage({ params: Promise.resolve({ id: claim.id }) }));

    expect(screen.getByRole("img", { name: "Accident Photo evidence, attachment 1" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Additional Information evidence, attachment 3" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open securely: Accident Photo: rear-damage.jpg" }).getAttribute("href")).toBe("/api/admin/claims/claim-1/documents/photo-1");
    expect(screen.getByRole("link", { name: "Download Police Report: report.pdf" }).getAttribute("href")).toBe("/api/admin/claims/claim-1/documents/report-1?download=1");
    expect(screen.getByRole("link", { name: "Open securely: Additional Information: follow-up.jpg" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download Additional Information: follow-up.jpg" })).toBeTruthy();
    expect(screen.getByText("rear-damage.jpg")).toBeTruthy();
    expect(screen.getByText("report.pdf")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
    expect(container.innerHTML).not.toContain("private/path/");
  });
});
