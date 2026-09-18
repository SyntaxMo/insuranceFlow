// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedProfileMock } = vi.hoisted(() => ({ getAuthenticatedProfileMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/(auth)/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedProfile: getAuthenticatedProfileMock,
  isStaffRole: (role: string) => role === "CLAIMS_OFFICER" || role === "ADMIN",
}));

import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome";

describe("shared branded chrome", () => {
  beforeEach(() => getAuthenticatedProfileMock.mockResolvedValue(null));
  afterEach(cleanup);

  it("uses the supplied logo and public routes", async () => {
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "InsureFlow home" }).getAttribute("href")).toBe("/");
    expect(screen.getByTestId("insureflow-logo").getAttribute("src")).toContain("insureflow-mark.webp");
    expect(screen.getByRole("link", { name: "Insurance" }).getAttribute("href")).toBe("/#coverage");
    expect(screen.getByRole("link", { name: "How it works" }).getAttribute("href")).toBe("/#how-it-works");
    expect(screen.getByRole("link", { name: "Claims" }).getAttribute("href")).toBe("/#claims");
    expect(screen.getByRole("link", { name: "AI" }).getAttribute("href")).toBe("/#ai");
    expect(screen.getByRole("link", { name: "Help" }).getAttribute("href")).toBe("/#help");
    expect(screen.getAllByRole("link").filter((link) => ["Insurance", "How it works", "Claims", "AI", "Help"].includes(link.textContent ?? "")).map((link) => link.textContent)).toEqual(["Insurance", "How it works", "Claims", "AI", "Help"]);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("href")).toBe("/signup");
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "New Claim" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign Out" })).toBeNull();
  });

  it("uses a dashboard brand link and account-only navigation for customers", async () => {
    const user = userEvent.setup();
    getAuthenticatedProfileMock.mockResolvedValue({
      role: "CUSTOMER",
      full_name: "Mohammed Essam",
      email: "mohammed@example.com",
    });
    render(await SiteHeader());
    const brand = screen.getByRole("link", { name: "InsureFlow dashboard" });
    expect(brand.getAttribute("href")).toBe("/dashboard");
    expect(brand.className).toContain("cursor-pointer");
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "New Claim" })).toBeNull();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign Out" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Profile" }).getAttribute("href")).toBe("/dashboard/profile");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).toBeNull();
  });

  it("does not show the customer account menu in staff navigation", async () => {
    getAuthenticatedProfileMock.mockResolvedValue({ role: "CLAIMS_OFFICER" });
    render(await SiteHeader());
    expect(screen.queryByRole("button", { name: "Account menu" })).toBeNull();
    expect(screen.getByRole("link", { name: "InsureFlow home" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Claims" }).getAttribute("href")).toBe("/admin/claims");
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy();
  });

  it("keeps the compact legal footer and new brand lockup", () => {
    render(<SiteFooter />);
    expect(screen.getByText("Motor insurance workflows, made clearer.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: "Disclaimer" }).getAttribute("href")).toBe("/disclaimer");
  });
});
