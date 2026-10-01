// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/app/dashboard/policies/link/actions", () => ({
  lookupExistingPolicyAction: lookup,
  sendPolicyVerificationCodeAction: vi.fn(),
  verifyPolicyCodeAction: vi.fn(),
}));
import { LinkPolicyForm } from "./LinkPolicyForm";
afterEach(cleanup);
it("announces lookup progress and the result without reading the whole policy card", async () => {
  let complete: (value: unknown) => void = () => undefined;
  lookup.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  render(<LinkPolicyForm />);
  fireEvent.change(screen.getByLabelText("Policy number"), { target: { value: "POL-123" } });
  fireEvent.change(screen.getByLabelText("Registered email"), { target: { value: "demo@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Find policy" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Checking policy…"));
  complete({ match: { vehicle: { make: "Toyota", model: "Corolla", year: 2026 }, maskedPolicyNumber: "••••1234", coverageType: "COMPREHENSIVE", status: "ACTIVE", startDate: "2026-01-01", endDate: "2027-01-01", maskedEmail: "d••••o@example.com", isExpired: false } });
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Policy found."));
});
