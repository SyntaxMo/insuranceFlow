// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestEmailChangeAction: vi.fn() }));

vi.mock("@/app/dashboard/profile/actions", () => ({
  requestEmailChangeAction: mocks.requestEmailChangeAction,
}));

import { ChangeEmailControl } from "@/components/profile/ChangeEmailControl";

describe("ChangeEmailControl", () => {
  beforeEach(() => {
    mocks.requestEmailChangeAction.mockResolvedValue({
      success: true,
      pendingEmail: "new@example.com",
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens an accessible modal and Cancel restores focus", async () => {
    const user = userEvent.setup();
    render(<ChangeEmailControl currentEmail="current@example.com" />);
    const trigger = screen.getByRole("button", { name: "Change email" });
    expect(trigger.querySelector('[data-testid="pencil-icon"]')).toBeTruthy();
    expect(screen.queryByText("Change email")).toBeNull();

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Change email address" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("New email address"));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("closes with Escape without sending a request", async () => {
    const user = userEvent.setup();
    render(<ChangeEmailControl currentEmail="current@example.com" />);
    await user.click(screen.getByRole("button", { name: "Change email" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.requestEmailChangeAction).not.toHaveBeenCalled();
  });

  it("submits only the new email and shows pending-verification feedback", async () => {
    const user = userEvent.setup();
    render(<ChangeEmailControl currentEmail="current@example.com" />);
    await user.click(screen.getByRole("button", { name: "Change email" }));
    await user.type(screen.getByLabelText("New email address"), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Send verification" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Confirm your email change");
    expect(status.textContent).toContain("current and new email addresses");
    expect(status.textContent).toContain("Current emailcurrent@example.com");
    expect(status.textContent).toContain("New emailnew@example.com");
    expect(status.textContent).not.toContain("Supabase");
    expect(mocks.requestEmailChangeAction).toHaveBeenCalledOnce();
    const submitted = mocks.requestEmailChangeAction.mock.calls[0]?.[1] as FormData;
    expect(Array.from(submitted.keys())).toEqual(["email"]);
    expect(submitted.get("email")).toBe("new@example.com");
  });
});
