// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClaimsQueue } from "@/components/admin/ClaimsQueue";

afterEach(cleanup);

const claims = [
  { id: "1", claimNumber: "CLM-NEW", policyNumber: "POL-1", vehicleLabel: "Toyota Corolla (2026)", accidentDate: "2026-09-01", status: "SUBMITTED", createdAt: "2026-09-02T10:00:00Z", updatedAt: "2026-09-02T10:00:00Z", customerName: "Aisha Ali", hasAiAnalysis: false, customerResponded: false },
  { id: "2", claimNumber: "CLM-WAIT", policyNumber: "POL-2", vehicleLabel: "Kia Sorento (2025)", accidentDate: "2026-09-03", status: "MORE_INFO_REQUIRED", createdAt: "2026-09-04T10:00:00Z", updatedAt: "2026-09-04T10:00:00Z", customerName: "Mohammed Hasan", hasAiAnalysis: true, customerResponded: false },
];

describe("ClaimsQueue", () => {
  it("shows operational labels and filters by status", () => {
    render(<ClaimsQueue claims={claims} />);
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Waiting on Customer" }));
    expect(screen.queryByText("CLM-NEW")).toBeNull();
    expect(screen.getAllByText("CLM-WAIT").length).toBeGreaterThan(0);
  });

  it("searches claim, customer, and policy fields locally", () => {
    render(<ClaimsQueue claims={claims} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Aisha" } });
    expect(screen.getAllByText("CLM-NEW").length).toBeGreaterThan(0);
    expect(screen.queryByText("CLM-WAIT")).toBeNull();
  });
});
