// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestPasswordChangeCodeAction: vi.fn(), updatePasswordAction: vi.fn() }));

vi.mock("@/app/dashboard/profile/actions", () => ({
  requestPasswordChangeCodeAction: mocks.requestPasswordChangeCodeAction,
  updatePasswordAction: mocks.updatePasswordAction,
}));

import { ChangePasswordControl } from "@/components/profile/ChangePasswordControl";

describe("ChangePasswordControl", () => {
  beforeEach(() => {
    mocks.requestPasswordChangeCodeAction.mockResolvedValue({ success: true });
    mocks.updatePasswordAction.mockResolvedValue({ success: true });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  async function reachPasswordStep(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await user.click(screen.getByRole("button", { name: "Send code" }));
    return screen.findByRole("dialog", { name: "Set a new password" });
  }

  it("opens the concise verification request dialog", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordControl currentEmail="verified@example.com" />);
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByRole("dialog", { name: "Verify before changing your password" })).toBeTruthy();
    expect(screen.getByText("We'll send a verification code to your account email.")).toBeTruthy();
    expect(screen.getByText("verified@example.com")).toBeTruthy();
  });

  it("requests a code without submitting a browser-provided recipient", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordControl currentEmail="verified@example.com" />);
    await reachPasswordStep(user);
    const submitted = mocks.requestPasswordChangeCodeAction.mock.calls[0]?.[1] as FormData;
    expect(Array.from(submitted.keys())).toEqual([]);
  });

  it("rejects an extra digit without submitting the password", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordControl currentEmail="verified@example.com" />);
    const dialog = await reachPasswordStep(user);
    await user.type(screen.getByLabelText("Verification code"), "658725701");
    await user.type(screen.getByLabelText("New password"), "NewSecurePassword1!");
    await user.type(screen.getByLabelText("Confirm new password"), "NewSecurePassword1!");
    await user.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect(screen.getByText("Enter the 8-digit verification code.")).toBeTruthy();
    expect(mocks.updatePasswordAction).not.toHaveBeenCalled();
  });

  it("preserves every field after a password mismatch and permits correction", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordControl currentEmail="verified@example.com" />);
    const dialog = await reachPasswordStep(user);
    const code = screen.getByLabelText("Verification code") as HTMLInputElement;
    const password = screen.getByLabelText("New password") as HTMLInputElement;
    const confirmation = screen.getByLabelText("Confirm new password") as HTMLInputElement;
    await user.type(code, "65872570");
    await user.type(password, "NewSecurePassword1!");
    await user.type(confirmation, "DifferentPassword1!");
    await user.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(code.value).toBe("65872570");
    expect(password.value).toBe("NewSecurePassword1!");
    expect(confirmation.value).toBe("DifferentPassword1!");
    expect(mocks.updatePasswordAction).not.toHaveBeenCalled();

    await user.clear(confirmation);
    await user.type(confirmation, "NewSecurePassword1!");
    await user.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("status")).textContent).toContain("Password updated");
    expect(screen.getByText("Your new password is ready to use.")).toBeTruthy();
    expect(mocks.updatePasswordAction).toHaveBeenCalledOnce();
  });

  it("submits the exact code and matching password", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordControl currentEmail="verified@example.com" />);
    const dialog = await reachPasswordStep(user);
    await user.type(screen.getByLabelText("Verification code"), "65872570");
    await user.type(screen.getByLabelText("New password"), "NewSecurePassword1!");
    await user.type(screen.getByLabelText("Confirm new password"), "NewSecurePassword1!");
    await user.click(within(dialog).getByRole("button", { name: "Change password" }));
    const submitted = mocks.updatePasswordAction.mock.calls[0]?.[1] as FormData;
    expect(Object.fromEntries(submitted)).toEqual({
      verificationCode: "65872570", password: "NewSecurePassword1!", confirmPassword: "NewSecurePassword1!",
    });
  });

  it("closes with Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordControl currentEmail="verified@example.com" />);
    const trigger = screen.getByRole("button", { name: "Change password" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.requestPasswordChangeCodeAction).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
