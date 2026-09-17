// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock }) }));
import { CustomerClaimResponse } from "@/components/dashboard/CustomerClaimResponse";

describe("CustomerClaimResponse", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("shows the officer request and submits a response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<CustomerClaimResponse claimId="claim-1" requestMessage="Please upload the police report." />);
    expect(screen.getByText("Please upload the police report.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your response"), { target: { value: "Uploaded as requested." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit information" }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard/claims/claim-1?submitted=1"));
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/customer/claims/claim-1/response", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
  });

  it("preserves the response and does not show success navigation when submission fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "The additional information could not be saved." }), { status: 409 }),
    );
    render(<CustomerClaimResponse claimId="claim-1" requestMessage="Please clarify the repair estimate." />);
    const response = screen.getByLabelText("Your response") as HTMLTextAreaElement;
    fireEvent.change(response, { target: { value: "Here is the clarification." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit information" }));

    expect(await screen.findByText("The additional information could not be saved.")).toBeTruthy();
    expect(response.value).toBe("Here is the clarification.");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
