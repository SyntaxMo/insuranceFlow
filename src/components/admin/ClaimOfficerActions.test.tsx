// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { ClaimOfficerActions } from "@/components/admin/ClaimOfficerActions";

describe("ClaimOfficerActions", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("opens Start review confirmation without transitioning immediately", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<ClaimOfficerActions claimId="claim-1" status="SUBMITTED" />);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    const dialog = screen.getByRole("dialog", { name: "Start reviewing this claim?" });
    expect(within(dialog).getByText(/move the claim from New to Under Review/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels without transitioning and restores focus to Start review", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<ClaimOfficerActions claimId="claim-1" status="SUBMITTED" />);
    const trigger = screen.getByRole("button", { name: "Start review" });
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes the confirmation with Escape", async () => {
    render(<ClaimOfficerActions claimId="claim-1" status="SUBMITTED" />);
    const trigger = screen.getByRole("button", { name: "Start review" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps keyboard focus inside the confirmation dialog", async () => {
    render(<ClaimOfficerActions claimId="claim-1" status="SUBMITTED" />);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Close dialog" });
    const confirm = within(dialog).getByRole("button", { name: "Start review" });
    await waitFor(() => expect(document.activeElement).toBe(close));
    confirm.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("confirms Start review once and disables duplicate submissions while pending", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    render(<ClaimOfficerActions claimId="claim-1" status="SUBMITTED" />);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Start review" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    const pendingButton = screen.getByRole("button", { name: "Starting review…" }) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    expect(pendingButton.getAttribute("aria-busy")).toBe("true");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/claims/claim-1/transition",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "start_review", note: "" }),
      }),
    );
    resolveFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
  });

  it("keeps a stale Start review dialog open and shows the safe server error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "This action is no longer valid for the claim's current status. Refresh and try again." }), { status: 409 }),
    );
    render(<ClaimOfficerActions claimId="claim-1" status="SUBMITTED" />);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start review" }));
    expect(await screen.findByText(/no longer valid for the claim's current status/i)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("removes Return to New while preserving under-review actions", () => {
    render(<ClaimOfficerActions claimId="claim-1" status="UNDER_REVIEW" />);
    expect(screen.queryByRole("button", { name: "Return to New" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send request" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve claim" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject claim" })).toBeTruthy();
  });

  it("requires confirmation and a reason before rejection", () => {
    render(<ClaimOfficerActions claimId="claim-1" status="UNDER_REVIEW" />);
    fireEvent.click(screen.getByRole("button", { name: "Reject claim" }));
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByRole("button", { name: "Reject claim" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Rejection reason"), { target: { value: "Customer-safe reason" } });
    expect((within(dialog).getByRole("button", { name: "Reject claim" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders closed claims as read-only", () => {
    render(<ClaimOfficerActions claimId="claim-1" status="CLOSED" />);
    expect(screen.getByText(/closed and read-only/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /approve|reject|request/i })).toBeNull();
  });
});
