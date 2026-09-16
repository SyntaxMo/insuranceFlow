// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { ClaimOfficerActions } from "@/components/admin/ClaimOfficerActions";

describe("ClaimOfficerActions", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("requires confirmation and a reason before rejection", () => {
    render(<ClaimOfficerActions claimId="claim-1" status="UNDER_REVIEW" />);
    fireEvent.click(screen.getByRole("button", { name: "Reject claim" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Reject claim" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Rejection reason"), { target: { value: "Customer-safe reason" } });
    expect((within(dialog).getByRole("button", { name: "Reject claim" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables duplicate actions and refreshes after a successful transition", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    render(<ClaimOfficerActions claimId="claim-1" status="SUBMITTED" />);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    expect((screen.getByRole("button", { name: "Starting review…" }) as HTMLButtonElement).disabled).toBe(true);
    resolveFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it("confirms Return to New only from an under-review claim", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const { rerender } = render(
      <ClaimOfficerActions claimId="claim-1" status="UNDER_REVIEW" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Return to New" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Return this claim to the New queue?")).toBeTruthy();
    expect(within(dialog).getByText(/Previous review activity will remain/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Return to New" }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/claims/claim-1/transition",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "return_to_new", note: "" }),
      }),
    );

    rerender(<ClaimOfficerActions claimId="claim-1" status="MORE_INFO_REQUIRED" />);
    expect(screen.queryByRole("button", { name: "Return to New" })).toBeNull();
  });

  it("renders closed claims as read-only", () => {
    render(<ClaimOfficerActions claimId="claim-1" status="CLOSED" />);
    expect(screen.getByText(/closed and read-only/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /approve|reject|request/i })).toBeNull();
  });
});
