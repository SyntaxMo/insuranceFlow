// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedProfileMock } = vi.hoisted(() => ({
  getAuthenticatedProfileMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/(auth)/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedProfile: getAuthenticatedProfileMock,
  isStaffRole: (role: string) => role === "CLAIMS_OFFICER" || role === "ADMIN",
  routeForRole: (role: string) => role === "CUSTOMER" ? "/dashboard" : "/admin",
}));
import TermsPage from "@/app/terms/page";
import PrivacyPage from "@/app/privacy/page";
import DisclaimerPage from "@/app/disclaimer/page";
import { SiteFooter } from "@/components/layout/SiteChrome";

describe("public legal information", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedProfileMock.mockResolvedValue(null);
  });

  it.each([
    ["Terms & Conditions", TermsPage],
    ["Privacy Policy", PrivacyPage],
    ["Insurance & Demo Disclaimer", DisclaimerPage],
  ])("renders the %s route content", async (title, Page) => {
    render(await Page());
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy();
    expect(screen.getByRole("link", { name: "← Back to InsureFlow" }).getAttribute("href")).toBe("/");
    expect(screen.queryByText("InsureFlow transparency")).toBeNull();
    expect(screen.queryByText("Important information")).toBeNull();
  });

  it("returns an authenticated customer to the dashboard", async () => {
    getAuthenticatedProfileMock.mockResolvedValue({ role: "CUSTOMER" });
    render(await TermsPage());
    expect(screen.getByRole("link", { name: "← Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it("returns authenticated staff to the existing admin home", async () => {
    getAuthenticatedProfileMock.mockResolvedValue({ role: "CLAIMS_OFFICER" });
    render(await PrivacyPage());
    expect(screen.getByRole("link", { name: "← Back to admin" }).getAttribute("href")).toBe("/admin");
  });

  it("includes the refined Terms wording", async () => {
    render(await TermsPage());
    expect(screen.getByText(/portfolio review purposes/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Third-party services" })).toBeTruthy();
    expect(screen.getByText(/AI-assisted outputs are advisory and require human review/)).toBeTruthy();
  });

  it("includes operational records and data-deletion transparency", async () => {
    render(await PrivacyPage());
    expect(screen.getByRole("heading", { name: "Verification and operational records" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Data access and deletion" })).toBeTruthy();
    expect(screen.getByText(/Depending on the model selected through OpenRouter/)).toBeTruthy();
  });

  it("includes the accuracy and availability disclaimer", async () => {
    render(await DisclaimerPage());
    expect(screen.getByRole("heading", { name: "No guarantee of accuracy or availability" })).toBeTruthy();
    expect(screen.getByText(/should not be treated as authoritative/)).toBeTruthy();
  });

  it("links the shared footer to every public legal route", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: "Disclaimer" }).getAttribute("href")).toBe("/disclaimer");
  });
});
