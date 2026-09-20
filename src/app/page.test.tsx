// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedProfileMock, redirectMock } = vi.hoisted(() => ({
  getAuthenticatedProfileMock: vi.fn(),
  redirectMock: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));

vi.mock("@/components/marketing/Reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedProfile: getAuthenticatedProfileMock,
  routeForRole: (role: string) => role === "CUSTOMER" ? "/dashboard" : "/admin",
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import HomePage, { PublicHomePage } from "@/app/page";

describe("premium public landing page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the informational cookie notice to a first-time public visitor", async () => {
    window.localStorage.clear();
    render(<PublicHomePage />);
    expect(await screen.findByRole("complementary", { name: "Cookies on InsureFlow" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /accept all|reject all/i })).toBeNull();
  });

  it("renders the product story and existing CTA routes", () => {
    render(<PublicHomePage />);
    expect(document.querySelector("[data-cursor-ambient-glow]")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Drive with confidence." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "AI-assisted claims, human decisions." })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Create account" })[0].getAttribute("href")).toBe("/signup");
    expect(screen.getByRole("link", { name: "Explore how it works" }).getAttribute("href")).toBe("#how-it-works");
    expect(document.getElementById("how-it-works")).toBeTruthy();
    expect(document.getElementById("claims")).toBeTruthy();
    expect(document.getElementById("ai")).toBeTruthy();
    expect(document.getElementById("help")).toBeTruthy();
    expect(document.getElementById("coverage")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Need help?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View FAQs" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("heading", { name: "A simpler side-by-side view." })).toBeTruthy();
    expect(screen.getByText("BHD 100,000")).toBeTruthy();
  });

  it("loads the optimized car visual with descriptive alternative text", () => {
    render(<PublicHomePage />);
    const image = screen.getByAltText("Modern dark blue crossover illustrating digital motor insurance coverage");
    expect(image.getAttribute("src")).toContain("hero-car.webp");
    expect(screen.getAllByAltText(/Modern dark blue crossover/)).toHaveLength(1);
  });

  it("renders the public landing page for an unauthenticated root request", async () => {
    getAuthenticatedProfileMock.mockResolvedValueOnce(null);
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Drive with confidence." })).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects an authenticated customer before returning public page content", async () => {
    getAuthenticatedProfileMock.mockResolvedValueOnce({ role: "CUSTOMER" });
    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("preserves the existing staff destination at the root", async () => {
    getAuthenticatedProfileMock.mockResolvedValueOnce({ role: "CLAIMS_OFFICER" });
    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/admin");
    expect(redirectMock).toHaveBeenCalledWith("/admin");
  });
});
