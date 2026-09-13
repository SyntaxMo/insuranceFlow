// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HeroCoverageStory } from "@/components/marketing/HeroCoverageStory";

describe("combined hero and coverage story", () => {
  afterEach(cleanup);

  it("renders one car for both hero and coverage", () => {
    render(<HeroCoverageStory />);
    expect(screen.getAllByAltText(/Modern dark blue crossover/)).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Drive with confidence." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "See how coverage can differ." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compare both" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Fast & easy")).toBeTruthy();
    expect(screen.getByText("Transparent")).toBeTruthy();
    expect(screen.getByText("AI-assisted")).toBeTruthy();
    expect(screen.queryByText("Policy status")).toBeNull();
    expect(screen.queryByText("Claim tracking")).toBeNull();
  });

  it("shows an anchored tooltip while a hotspot is focused", () => {
    render(<HeroCoverageStory />);
    const hotspot = screen.getByRole("button", { name: "Compare Front bumper Compare both coverage example" });
    fireEvent.focus(hotspot);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(screen.getByText("Front bumper")).toBeTruthy();
    expect(screen.getByText(/own-vehicle impact protection/i)).toBeTruthy();
    expect(screen.getByText(/own-bumper damage is not included/i)).toBeTruthy();
    fireEvent.blur(hotspot);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("updates hotspot copy for Third Party mode", async () => {
    const user = userEvent.setup();
    render(<HeroCoverageStory />);
    await user.click(screen.getByRole("button", { name: "Third Party" }));
    expect(screen.getByText(/focuses on liability involving other people and property rather than damage to your own vehicle/i)).toBeTruthy();
    const hotspot = screen.getByRole("button", { name: "Show Windshield Third Party coverage example" });
    expect(hotspot.hasAttribute("disabled")).toBe(false);
    fireEvent.mouseEnter(hotspot);
    expect(screen.getByText(/own-windshield damage is not included/i)).toBeTruthy();
    fireEvent.mouseLeave(hotspot);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps Comprehensive as a focused single-mode exploration", async () => {
    const user = userEvent.setup();
    render(<HeroCoverageStory />);
    await user.click(screen.getByRole("button", { name: "Comprehensive" }));
    const hotspot = screen.getByRole("button", { name: "Show Rear body Comprehensive coverage example" });
    fireEvent.focus(hotspot);
    expect(screen.getByRole("tooltip").textContent).toContain("Example rear-body damage protection");
    expect(screen.getByRole("tooltip").textContent).not.toContain("Own rear-body damage is not included");
  });

  it("toggles one tooltip for touch and dismisses it outside the car", () => {
    render(<HeroCoverageStory />);
    const windshield = screen.getByRole("button", { name: "Compare Windshield Compare both coverage example" });
    const bumper = screen.getByRole("button", { name: "Compare Front bumper Compare both coverage example" });

    fireEvent.pointerDown(windshield, { pointerType: "touch" });
    expect(screen.getByRole("tooltip").textContent).toContain("Windshield");

    fireEvent.pointerDown(bumper, { pointerType: "touch" });
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip").textContent).toContain("Front bumper");

    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("switches to a subtle liability perspective without adding another car", async () => {
    const user = userEvent.setup();
    render(<HeroCoverageStory />);
    await user.click(screen.getByRole("button", { name: "Other people & property" }));
    expect(screen.getAllByAltText(/Modern dark blue crossover/)).toHaveLength(1);
    expect(screen.getByText(/Both options include third-party liability here/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Windshield/ })).toBeNull();
  });
});
