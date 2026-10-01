// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireStaff: vi.fn(), createServerClient: vi.fn(), request: vi.fn(), update: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("./actions", () => ({ requestPasswordChangeCodeAction: mocks.request, updatePasswordAction: mocks.update }));
vi.mock("@/app/dashboard/profile/actions", () => ({ requestPasswordChangeCodeAction: vi.fn(), updatePasswordAction: vi.fn() }));
import StaffProfilePage, { metadata } from "./page";

describe("staff profile", () => {
  beforeEach(() => {
    mocks.requireStaff.mockResolvedValue({ id: "staff-profile", auth_user_id: "staff-auth", full_name: "Officer Name", email: "old@example.com", role: "CLAIMS_OFFICER", created_at: "2026-09-12T09:00:00Z" });
    mocks.createServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-auth", email: "work@example.com" } }, error: null }) } });
    mocks.request.mockResolvedValue({ success: true });
    mocks.update.mockResolvedValue({ success: true });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders only organization-managed identity and a static password indicator", async () => {
    render(<main>{await StaffProfilePage()}</main>);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(metadata.title).toBe("Staff profile | InsureFlow");
    expect(screen.getByRole("link", { name: "Back to claims" }).getAttribute("href")).toBe("/admin/claims");
    expect(screen.getByRole("heading", { name: "Account details" })).toBeTruthy();
    expect(screen.getByText("Your staff account details are managed by your organization.")).toBeTruthy();
    for (const value of ["Officer Name", "work@example.com", "Claims Officer", "Sep 12, 2026", "Password is set"]) expect(screen.getByText(value)).toBeTruthy();
    expect(screen.queryByText("old@example.com")).toBeNull();
    const mask = screen.getByText("••••••••"); expect(mask.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Change password"]);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Account activity" })).toBeNull();
    expect(screen.queryByText(/staff-profile|staff-auth|CLAIMS_OFFICER/)).toBeNull();
  });

  it("displays an administrator's friendly role", async () => {
    mocks.requireStaff.mockResolvedValue({ full_name: "Admin", auth_user_id: "staff-auth", role: "ADMIN", created_at: null });
    render(await StaffProfilePage());
    expect(screen.getByText("Administrator")).toBeTruthy();
    expect(screen.getByText("Not available")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /name|email|role/i })).toBeNull();
  });

  it.each(["/dashboard", "/login"])("honors the established staff guard redirect to %s", async (destination) => {
    mocks.requireStaff.mockRejectedValueOnce(new Error(`NEXT_REDIRECT:${destination}`));
    await expect(StaffProfilePage()).rejects.toThrow(`NEXT_REDIRECT:${destination}`);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("uses staff entry points with the shared password dialog and restores focus on success", async () => {
    const user = userEvent.setup();
    render(await StaffProfilePage());
    const trigger = screen.getByRole("button", { name: "Change password" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Verify before changing your password" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Send code" }));
    const dialog = await screen.findByRole("dialog", { name: "Set a new password" });
    await user.type(screen.getByLabelText("Verification code"), "65872570");
    await user.type(screen.getByLabelText("New password"), "NewSecurePassword1!");
    await user.type(screen.getByLabelText("Confirm new password"), "NewSecurePassword1!");
    await user.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("status")).textContent).toContain("Password updated");
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
