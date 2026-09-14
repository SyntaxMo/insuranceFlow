// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketing/Reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import HomePage from "@/app/page";

describe("premium public landing page", () => {
  afterEach(cleanup);

  it("renders the product story and existing CTA routes", () => {
    render(<HomePage />);
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
    render(<HomePage />);
    const image = screen.getByAltText("Modern dark blue crossover illustrating digital motor insurance coverage");
    expect(image.getAttribute("src")).toContain("hero-car.webp");
    expect(screen.getAllByAltText(/Modern dark blue crossover/)).toHaveLength(1);
  });
});
