// @vitest-environment jsdom

import { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmationToast } from "@/components/auth/ConfirmationToast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("ConfirmationToast", () => {
  it("shows once, removes the URL marker, and dismisses itself", () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/dashboard?confirmed=1");

    render(<ConfirmationToast />);

    expect(screen.getByRole("status").textContent).toContain(
      "Your email has been confirmed.",
    );
    expect(window.location.pathname).toBe("/dashboard");
    expect(window.location.search).toBe("");

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("consumes only the policy-link marker and keeps unrelated query state", () => {
    window.history.replaceState({}, "", "/dashboard?policyLinked=1&tab=claims");

    render(
      <ConfirmationToast
        marker="policyLinked"
        message="Policy linked successfully."
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Policy linked successfully.",
    );
    expect(window.location.search).toBe("?tab=claims");
  });
});
