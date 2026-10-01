// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { recovery, reset } = vi.hoisted(() => ({ recovery: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth/recovery", () => ({ getRecoveryClient: recovery }));
vi.mock("@/app/(auth)/recovery-actions", () => ({ requestPasswordReset: vi.fn(), resetPassword: reset }));
import ForgotPasswordPage from "./forgot-password/page";
import ResetPasswordPage from "./reset-password/page";
afterEach(cleanup);
it("renders public recovery request without requiring a session", () => {
  render(<ForgotPasswordPage />);
  expect(screen.getByRole("heading", { name: "Reset your password" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send reset link" })).toBeTruthy();
});
it("does not render password fields for invalid recovery", async () => {
  recovery.mockResolvedValue(null);
  render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText(/reset session is no longer active/)).toBeTruthy();
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(screen.getByRole("link", { name: "Request a new reset link" }).getAttribute("href")).toBe("/forgot-password");
});
it("renders the reset form only with verified recovery authorization", async () => {
  recovery.mockResolvedValue({});
  render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByLabelText("New password")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Update password" })).toBeTruthy();
});
it("an explicit invalid-link callback error cannot reuse an existing authorization", async () => {
  recovery.mockResolvedValue({});
  render(await ResetPasswordPage({ searchParams: Promise.resolve({ error: "invalid-recovery" }) }));
  expect(screen.queryByLabelText("New password")).toBeNull();
});

it("consumed recovery authorization cannot replace a successful reset with expired-link UI", async () => {
  recovery.mockResolvedValue({});
  reset.mockResolvedValue({ success: true });
  const view = render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
  for (const label of ["New password", "Confirm new password"]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: "password123" } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(await screen.findByRole("heading", { name: "Password updated" })).toBeTruthy();
  // Cookie deletion re-renders the server page with the recovery grant consumed.
  recovery.mockResolvedValue(null);
  view.rerender(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { name: "Password updated" })).toBeTruthy();
  expect(screen.getByText("You can now sign in with your new password.")).toBeTruthy();
  expect(screen.queryByText(/expired|no longer active/)).toBeNull();
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/login");
  view.unmount();
  render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(screen.getByText(/reset session is no longer active/)).toBeTruthy();
});
