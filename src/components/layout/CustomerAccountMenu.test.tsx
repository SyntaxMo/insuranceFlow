// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(auth)/actions", () => ({ signOutAction: vi.fn() }));

import { CustomerAccountMenu } from "@/components/layout/CustomerAccountMenu";

describe("CustomerAccountMenu", () => {
  afterEach(cleanup);

  it("renders a semantic icon trigger and opens the customer account menu", async () => {
    const user = userEvent.setup();
    render(<CustomerAccountMenu customerName="Mohammed Essam" customerEmail="mohammed@example.com" />);

    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.textContent).toBe("");
    expect(trigger.querySelector('[data-testid="default-profile-icon"]')).toBeTruthy();
    expect(trigger.className).toContain("cursor-pointer");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.className).toContain("ring-[var(--brand-teal)]");
    expect(screen.getByText("Mohammed Essam")).toBeTruthy();
    expect(screen.getByText("mohammed@example.com")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Profile" }).getAttribute("href")).toBe("/dashboard/profile");
    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).toBeNull();
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signOut.getAttribute("type")).toBe("submit");
    expect(signOut.closest("form")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Profile" }).className).toContain("cursor-pointer");
    expect(signOut.className).toContain("cursor-pointer");
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("opens the menu with the %s key", async (_label, key) => {
    const user = userEvent.setup();
    render(<CustomerAccountMenu customerName="Aisha" customerEmail="aisha@example.com" />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    trigger.focus();

    await user.keyboard(key);

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("supports keyboard opening, menu traversal, and Escape focus restoration", async () => {
    const user = userEvent.setup();
    render(<CustomerAccountMenu customerName="Aisha" customerEmail="aisha@example.com" />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    trigger.focus();

    await user.keyboard("{ArrowDown}");
    const profile = screen.getByRole("menuitem", { name: "Profile" });
    expect(document.activeElement).toBe(profile);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Sign out" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("uses the same generic icon when the customer name is unavailable", () => {
    render(<CustomerAccountMenu customerName={null} customerEmail={null} />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger.querySelector('[data-testid="default-profile-icon"]')).toBeTruthy();
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    render(<CustomerAccountMenu customerName="Aisha" customerEmail="aisha@example.com" />);
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menu")).toBeTruthy();

    await user.click(document.body);

    expect(screen.queryByRole("menu")).toBeNull();
  });
});
