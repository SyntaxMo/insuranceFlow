// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomerClaimSubmissionSuccess } from "@/components/dashboard/CustomerClaimSubmissionSuccess";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("CustomerClaimSubmissionSuccess", () => {
  it("announces the successful submission and consumes its one-time URL marker", () => {
    window.history.replaceState({}, "", "/dashboard/claims/claim-1?submitted=1&view=history");
    render(<CustomerClaimSubmissionSuccess />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Information submitted successfully");
    expect(status.textContent).toContain(
      "Your response and files were sent to the claims team. Your claim is now back under review.",
    );
    expect(window.location.pathname).toBe("/dashboard/claims/claim-1");
    expect(window.location.search).toBe("?view=history");
  });
});
