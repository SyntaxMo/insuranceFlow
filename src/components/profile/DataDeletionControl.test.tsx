// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ submit: vi.fn(), cancel: vi.fn() }));
vi.mock("@/app/dashboard/profile/deletion-actions", () => ({ submitDataDeletionRequestAction: mocks.submit, cancelDataDeletionRequestAction: mocks.cancel }));
import { DataDeletionControl } from "./DataDeletionControl";
const pendingRequest = { id: "98ad912f-7c76-48b4-8b4d-a0805beeb002", status: "PENDING" as const, createdAt: "2026-10-01", updatedAt: "2026-10-01", resolvedAt: null };
describe("customer data deletion request UI", () => {
  beforeEach(() => {
    mocks.submit.mockResolvedValue({ outcome: "received", request: pendingRequest, emailSent: true });
    mocks.cancel.mockResolvedValue({ outcome: "cancelled", request: { ...pendingRequest, status: "CANCELLED" } });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("requires acknowledgement, accepts an optional reason, and displays a receipt without claiming deletion", async () => {
    const user = userEvent.setup(); render(<DataDeletionControl request={null} />);
    await user.click(screen.getByRole("button", { name: "Request data deletion" }));
    const dialog = screen.getByRole("dialog", { name: "Request data deletion" });
    expect(within(dialog).getByText(/does not represent a real statutory deletion process/)).toBeTruthy();
    const submit = within(dialog).getByRole("button", { name: "Submit request" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect((screen.getByLabelText("Reason (optional)") as HTMLTextAreaElement).required).toBe(false);
    await user.type(screen.getByLabelText("Reason (optional)"), "Please review this demo account.");
    const acknowledgement = screen.getByRole("checkbox", { name: /I understand/i });
    expect((acknowledgement as HTMLInputElement).required).toBe(true);
    await user.click(acknowledgement); await user.click(submit);
    expect(await screen.findByRole("heading", { name: "Request received" })).toBeTruthy();
    expect(screen.getByText("Your data deletion request has been recorded for review.")).toBeTruthy();
    expect(screen.getByText("Your account and existing records remain available while the request is pending.")).toBeTruthy();
    const data = mocks.submit.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(data)).toEqual({ reason: "Please review this demo account.", acknowledged: "on" });
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Request data deletion" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel request" })));
  });

  it("preserves form values and focuses invalid reason after a server validation error", async () => {
    mocks.submit.mockResolvedValue({ fields: { reason: ["Reason must be 1,000 characters or fewer."] } });
    const user = userEvent.setup(); render(<DataDeletionControl request={null} />);
    await user.click(screen.getByRole("button", { name: "Request data deletion" }));
    const reason = screen.getByLabelText("Reason (optional)") as HTMLTextAreaElement;
    await user.type(reason, "Keep this entered reason"); await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    await screen.findByRole("alert");
    expect(reason.value).toBe("Keep this entered reason"); expect(reason.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(reason);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("allows explicit cancellation only from pending status and does not create another request", async () => {
    const user = userEvent.setup(); render(<DataDeletionControl request={pendingRequest} />);
    expect(screen.queryByRole("button", { name: "Request data deletion" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel request" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel your data deletion request?" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Keep request" }));
    await user.click(within(dialog).getByRole("button", { name: "Cancel request" }));
    expect(await screen.findByRole("heading", { name: "Request cancelled" })).toBeTruthy();
    expect(Object.fromEntries(mocks.cancel.mock.calls[0][1] as FormData)).toEqual({ requestId: pendingRequest.id, confirmed: "on" });
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("Cancelled")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Request data deletion" })).toBeTruthy();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it.each(["COMPLETED", "REJECTED", "CANCELLED"] as const)("shows %s readably without a cancellation control", (status) => {
    render(<DataDeletionControl request={{ ...pendingRequest, status }} />);
    expect(screen.getByText({ COMPLETED: "Completed", REJECTED: "Rejected", CANCELLED: "Cancelled" }[status])).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
  });

  it("traps keyboard focus, closes on Escape, and returns to the opener", async () => {
    const user = userEvent.setup(); render(<DataDeletionControl request={null} />);
    const trigger = screen.getByRole("button", { name: "Request data deletion" });
    trigger.focus(); await user.keyboard("{Enter}");
    const reason = screen.getByLabelText("Reason (optional)");
    expect(document.activeElement).toBe(reason);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("distinguishes a delivery failure from a failed request", async () => {
    mocks.submit.mockResolvedValue({ outcome: "received", request: pendingRequest, emailSent: false });
    const user = userEvent.setup(); render(<DataDeletionControl request={null} />);
    await user.click(screen.getByRole("button", { name: "Request data deletion" }));
    await user.click(screen.getByRole("checkbox")); await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(await screen.findByRole("heading", { name: "Request received" })).toBeTruthy();
    expect(screen.getByText(/recorded, but we could not send/i)).toBeTruthy();
  });

  it("does not pretend no request exists when the status lookup is unavailable", () => {
    render(<DataDeletionControl request={null} unavailable />);
    expect(screen.getByRole("status").textContent).toMatch(/temporarily unavailable/i);
    expect(screen.queryByRole("button", { name: "Request data deletion" })).toBeNull();
  });
});
