// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
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
    await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/customer/claims/claim-1/response", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
  });
});
