// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
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
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import DisclaimerPage, { metadata as disclaimerMetadata } from "@/app/disclaimer/page";
import CookiePolicyPage, { metadata as cookieMetadata } from "@/app/cookies/page";
import { SiteFooter } from "@/components/layout/SiteChrome";

describe("public legal information", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getAuthenticatedProfileMock.mockResolvedValue(null);
  });

  it.each([
    ["Terms & Conditions", TermsPage, termsMetadata],
    ["Privacy Policy", PrivacyPage, privacyMetadata],
    ["Insurance & Demo Disclaimer", DisclaimerPage, disclaimerMetadata],
    ["Cookie Policy", CookiePolicyPage, cookieMetadata],
  ])("renders the %s route content", async (title, Page, metadata) => {
    render(<main>{await Page()}</main>);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(metadata.title).toBe(`${title} | InsureFlow`);
    expect(within(screen.getByRole("region", { name: "Last updated" })).getByText("October 1, 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "← Back to InsureFlow" }).getAttribute("href")).toBe("/");
    expect(screen.queryByText("InsureFlow transparency")).toBeNull();
    expect(screen.queryByText("Important information")).toBeNull();
  });

  it("returns an authenticated customer to the dashboard", async () => {
    getAuthenticatedProfileMock.mockResolvedValue({ role: "CUSTOMER" });
    render(await TermsPage());
    expect(screen.getByRole("link", { name: "← Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByText("Cookies on InsureFlow")).toBeNull();
  });

  it("returns authenticated staff to the existing admin home", async () => {
    getAuthenticatedProfileMock.mockResolvedValue({ role: "CLAIMS_OFFICER" });
    render(await PrivacyPage());
    expect(screen.getByRole("link", { name: "← Back to admin" }).getAttribute("href")).toBe("/admin");
    expect(screen.queryByText("Cookies on InsureFlow")).toBeNull();
  });

  it("shows the notice on the public Privacy route before acknowledgement", async () => {
    render(await PrivacyPage());
    expect(await screen.findByRole("complementary", { name: "Cookies on InsureFlow" })).toBeTruthy();
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
    expect(screen.getByText(/Customers can submit a data deletion request through their account settings/)).toBeTruthy();
    expect(screen.getByText(/Requests are reviewed rather than processed automatically/)).toBeTruthy();
    expect(screen.getByText(/does not provide complete self-service data export or immediate account deletion/)).toBeTruthy();
    expect(screen.getByText(/Depending on the model selected through OpenRouter/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cookies and browser storage" })).toBeTruthy();
    expect(screen.getByText(/does not currently use advertising, analytics, marketing, or behavioral-tracking cookies/)).toBeTruthy();
  });

  it("explains AI metadata minimization without implying evidence is anonymized", async () => {
    render(await PrivacyPage());
    const ai = within(screen.getByRole("region", { name: "AI processing" }));
    expect(ai.getByText(/OpenRouter.*downstream model provider/)).toBeTruthy();
    expect(ai.getByText(/coverage guidance.*vehicle information/i)).toBeTruthy();
    expect(ai.getByText(/minimizes.*account.*internal metadata/i)).toBeTruthy();
    expect(ai.getByText(/not guaranteed to be anonymized before processing/)).toBeTruthy();
    expect(ai.getByText(/personal or sensitive information/)).toBeTruthy();
    expect(ai.getByText(/human review/)).toBeTruthy();
  });

  it("describes retention, recovery emails, and private document access without operational details", async () => {
    render(await PrivacyPage());
    expect(within(screen.getByRole("region", { name: "Data retention" })).getByText(/does not currently publish a fixed retention schedule/)).toBeTruthy();
    const emails = within(screen.getByRole("region", { name: "Email communications" }));
    expect(emails.getByText(/Resend/)).toBeTruthy();
    expect(emails.getByText(/password reset links/)).toBeTruthy();
    expect(emails.getByText(/password-change verification/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Verification and operational records" })).getByText(/password verification and recovery/)).toBeTruthy();
    const security = within(screen.getByRole("region", { name: "Authentication and security" }));
    expect(security.getByText(/private access controls.*short-lived signed document links/)).toBeTruthy();
    expect(security.queryByText(/service.role|bucket|\b120\b|\b180\b|RLS/)).toBeNull();
    expect(screen.queryByText(/Google Fonts|GDPR compliance|PDPL compliance/)).toBeNull();
  });

  it("describes only essential storage and future optional controls", async () => {
    render(await CookiePolicyPage());
    expect(screen.getByRole("heading", { name: "Essential cookies and storage" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Optional cookies" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How InsureFlow uses them" })).toBeTruthy();
    expect(screen.getByText("InsureFlow does not currently use advertising, analytics, marketing, or behavioral-tracking cookies.")).toBeTruthy();
    expect(screen.getByText(/small acknowledgement in your browser/)).toBeTruthy();
    expect(screen.getByText(/does not contain your name, email address, account ID/)).toBeTruthy();
    const lastUse = screen.getByText("remember whether the cookie notice has been acknowledged");
    const closingCopy = screen.getByText("These technologies are necessary for core features of the application to work correctly.");
    expect(lastUse.compareDocumentPosition(closingCopy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByRole("complementary", { name: "Cookies on InsureFlow" })).toBeTruthy();
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
    expect(screen.getByRole("link", { name: "Cookie Policy" }).getAttribute("href")).toBe("/cookies");
    expect(screen.getByRole("link", { name: "Disclaimer" }).getAttribute("href")).toBe("/disclaimer");
  });
});
