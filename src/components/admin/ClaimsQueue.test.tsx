// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClaimsQueue } from "@/components/admin/ClaimsQueue";

afterEach(cleanup);

const claims = [
  { id: "1", claimNumber: "CLM-NEW", policyNumber: "POL-1", vehicleLabel: "Toyota Corolla (2026)", accidentDate: "2026-09-01", status: "SUBMITTED", createdAt: "2026-09-02T10:00:00Z", updatedAt: "2026-09-02T10:00:00Z", customerName: "Aisha Ali", hasAiAnalysis: false, customerResponded: false },
  { id: "2", claimNumber: "CLM-WAIT", policyNumber: "POL-2", vehicleLabel: "Kia Sorento (2025)", accidentDate: "2026-09-03", status: "MORE_INFO_REQUIRED", createdAt: "2026-09-04T10:00:00Z", updatedAt: "2026-09-04T10:00:00Z", customerName: "Mohammed Hasan", hasAiAnalysis: true, customerResponded: false },
  { id: "3", claimNumber: "CLM-RESPONSE", policyNumber: "POL-3", vehicleLabel: "Honda Accord (2024)", accidentDate: "2026-09-05", status: "UNDER_REVIEW", createdAt: "2026-09-06T10:00:00Z", updatedAt: "2026-09-06T10:00:00Z", customerName: "Fatima Ahmed", hasAiAnalysis: true, customerResponded: true },
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

  it("keeps lifecycle status separate from secondary activity", () => {
    render(<ClaimsQueue claims={claims} />);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "Activity" })).toBeTruthy();

    const row = within(table).getByText("CLM-RESPONSE").closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLTableRowElement).getAllByRole("cell");
    expect(cells[5].textContent).toBe("Under Review");
    expect(cells[5].textContent).not.toContain("AI review ready");
    expect(cells[5].textContent).not.toContain("Customer responded");
    expect(cells[6].textContent).toContain("AI review ready");
    expect(cells[6].textContent).toContain("Customer responded");
  });

  it("shows persisted AI readiness in Activity and renders no activity quietly", () => {
    render(<ClaimsQueue claims={claims} />);
    const table = screen.getByRole("table");
    const aiRow = within(table).getByText("CLM-WAIT").closest("tr");
    const quietRow = within(table).getByText("CLM-NEW").closest("tr");
    expect(within(aiRow as HTMLTableRowElement).getByText("AI review ready")).toBeTruthy();
    expect(within(aiRow as HTMLTableRowElement).queryByText("Customer responded")).toBeNull();
    expect(within(quietRow as HTMLTableRowElement).getByLabelText("No secondary activity").textContent).toBe("—");
  });

  it("preserves row order and Review/View actions", () => {
    render(<ClaimsQueue claims={claims} />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      expect.stringContaining("CLM-NEW"),
      expect.stringContaining("CLM-WAIT"),
      expect.stringContaining("CLM-RESPONSE"),
    ]);
    expect(within(rows[0]).getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/admin/claims/1");
    expect(within(rows[1]).getByRole("link", { name: "View" }).getAttribute("href")).toBe("/admin/claims/2");
  });

  it("keeps every lifecycle status badge on one line", () => {
    const statuses = [
      ["SUBMITTED", "New"],
      ["UNDER_REVIEW", "Under Review"],
      ["MORE_INFO_REQUIRED", "Waiting on Customer"],
      ["APPROVED", "Approved"],
      ["REJECTED", "Rejected"],
      ["CLOSED", "Closed"],
    ] as const;
    render(
      <ClaimsQueue
        claims={statuses.map(([status], index) => ({
          ...claims[0],
          id: `status-${index}`,
          claimNumber: `CLM-STATUS-${index}`,
          status,
        }))}
      />,
    );

    const table = screen.getByRole("table");
    for (const [, label] of statuses) {
      expect(within(table).getByText(label).className).toContain("whitespace-nowrap");
    }
  });
});
