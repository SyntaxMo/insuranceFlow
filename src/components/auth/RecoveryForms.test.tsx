// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { request, reset } = vi.hoisted(() => ({ request: vi.fn(), reset: vi.fn() }));
vi.mock("@/app/(auth)/recovery-actions", () => ({ requestPasswordReset: request, resetPassword: reset }));
import { ForgotPasswordForm, ResetPasswordForm } from "./RecoveryForms";
beforeEach(() => { vi.clearAllMocks(); reset.mockResolvedValue({ success: true }); request.mockResolvedValue({ success: true, message: "If an account exists for that email, we’ve sent a password reset link." }); });
afterEach(cleanup);
it("shows a generic request confirmation and sign-in navigation", async () => {
  render(<ForgotPasswordForm />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByText(/If an account exists/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/login");
});
it("preserves both values and focuses confirmation on mismatch, then permits correction", async () => {
  render(<ResetPasswordForm />);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "password123" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different123" } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(screen.getByText("Passwords do not match.")).toBeTruthy();
  expect(screen.getByLabelText("Confirm new password").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByLabelText("Confirm new password").getAttribute("aria-describedby")).toBe("reset-confirmPassword-error");
  expect(screen.getByLabelText("New password").getAttribute("aria-describedby")).toBe("reset-password-hint");
  expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe("password123");
  expect((screen.getByLabelText("Confirm new password") as HTMLInputElement).value).toBe("different123");
  expect(document.activeElement).toBe(screen.getByLabelText("Confirm new password"));
  expect(reset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(await screen.findByRole("heading", { name: "Password updated" })).toBeTruthy();
  expect(screen.getByText("You can now sign in with your new password.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/login");
});
it("preserves values on a server rejection without showing success", async () => {
  reset.mockResolvedValue({ message: "This password reset link is invalid or has expired. Request a new reset link." });
  render(<ResetPasswordForm />);
  for (const label of ["New password", "Confirm new password"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  await waitFor(() => expect(screen.getByText(/invalid or has expired/)).toBeTruthy());
  expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe("password123");
  expect(screen.queryByRole("heading", { name: "Password updated" })).toBeNull();
});
