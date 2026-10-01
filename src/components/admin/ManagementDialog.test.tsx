// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ transition: vi.fn(), staff: vi.fn() }));
vi.mock("@/app/admin/management-actions", () => ({ transitionDeletionRequestAction: m.transition, updateClaimsOfficerAction: m.staff }));
import { RequestManagementActions, StaffManagementControl } from "./ManagementDialog";
const request = { id: "request", status: "PENDING" as const, createdAt: "2026-10-01", reason: null, resolutionNote: null, resolvedAt: null, customerName: "Customer", customerEmail: "customer@example.com" };
describe("admin management dialogs", () => {
  beforeEach(() => { m.transition.mockResolvedValue({ success: true, message: "Request is now processing." }); m.staff.mockResolvedValue({ success: true, message: "Staff account details updated." }); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("requires explicit process confirmation and restores focus after success", async () => {
    const user = userEvent.setup(); render(<RequestManagementActions request={request} />);
    const trigger = screen.getByRole("button", { name: "Start processing" }); await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Start processing" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
    expect((within(dialog).getByRole("button", { name: "Start processing" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Starting processing prevents customer cancellation/)).toBeTruthy();
    await user.click(screen.getByRole("checkbox")); await user.click(within(dialog).getByRole("button", { name: "Start processing" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(Object.fromEntries(m.transition.mock.calls[0][1])).toEqual({ requestId: "request", action: "process", confirmed: "on" });
    await user.click(screen.getByRole("button", { name: "Done" })); await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it.each(["COMPLETED", "CANCELLED", "REJECTED"] as const)("renders read-only %s history", status => { render(<RequestManagementActions request={{ ...request, status }} />); expect(screen.queryByRole("button")).toBeNull(); });
  it("preserves successful feedback when revalidation replaces the original action", async () => {
    const user = userEvent.setup();
    const view = render(<RequestManagementActions request={request} />);
    await user.click(screen.getByRole("button", { name: "Start processing" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start processing" }));
    await screen.findByRole("button", { name: "Done" });
    view.rerender(<RequestManagementActions request={{ ...request, status: "PROCESSING" }} />);
    expect(screen.getByRole("dialog", { name: "Changes saved" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Deletion request actions"));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mark completed" }));
  });
  it("shows only metadata completion for processing requests", async () => {
    const user = userEvent.setup(); render(<RequestManagementActions request={{ ...request, status: "PROCESSING" }} />);
    await user.click(screen.getByRole("button", { name: "Mark completed" }));
    expect(screen.getByText(/does not delete or anonymize/)).toBeTruthy(); expect(screen.getByLabelText("Resolution note")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start processing" })).toBeNull();
    await user.keyboard("{Escape}"); expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("preserves staff fields on errors and excludes role/password/auth controls", async () => {
    m.staff.mockResolvedValue({ fields: { email: ["Enter a valid work email."] }, message: "Check staff details." });
    const user = userEvent.setup(); render(<StaffManagementControl officer={{ id: "staff-reference", fullName: "Officer", email: "work@example.com", createdAt: "2026-10-01" }} />);
    await user.click(screen.getByRole("button", { name: "Manage" }));
    const email = screen.getByLabelText("Work email") as HTMLInputElement; await user.clear(email); await user.type(email, "bad-address");
    await user.click(screen.getByRole("checkbox")); await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(email.getAttribute("aria-invalid")).toBe("true"));
    expect(email.value).toBe("bad-address"); expect(document.activeElement).toBe(email);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Role: Claims Officer (read-only)")).toBeTruthy();
    expect(screen.queryByLabelText(/^(password|auth user id|role)$/i)).toBeNull();
    expect(Object.keys(Object.fromEntries(m.staff.mock.calls[0][1]))).toEqual(["staffId", "fullName", "email", "confirmed"]);
  });
});
