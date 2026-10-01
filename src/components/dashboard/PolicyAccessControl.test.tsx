// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { removeAction } = vi.hoisted(() => ({ removeAction: vi.fn() }));

vi.mock("@/app/dashboard/policies/actions", () => ({
  removeLinkedPolicyAction: removeAction,
}));

import { PolicyAccessControl } from "@/components/dashboard/PolicyAccessControl";

afterEach(cleanup);

describe("PolicyAccessControl", () => {
  beforeEach(() => { removeAction.mockReset(); });
  it("keeps removal in a management menu and requires confirmation", async () => {
    const user = userEvent.setup();
    render(
      <PolicyAccessControl policyId="2d0c1577-f1b2-4bf7-8b65-e8c23295d071" />,
    );

    await user.click(screen.getByRole("button", { name: "Policy management options" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove from account" }));

    expect(
      screen.getByRole("dialog", { name: "Remove policy from your account?" }),
    ).toBeTruthy();
    expect(screen.getByText(/It will not cancel the insurance policy/)).toBeTruthy();
    const dialog = screen.getByRole("dialog");
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toContain("It will not cancel");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove from account" })).toBeTruthy();
  });

  it("closes the menu with Escape and restores trigger focus", async () => {
    const user = userEvent.setup();
    render(
      <PolicyAccessControl policyId="2d0c1577-f1b2-4bf7-8b65-e8c23295d071" />,
    );
    const trigger = screen.getByRole("button", { name: "Policy management options" });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("traps focus while both confirmation buttons are disabled and restores it on Escape after failure", async () => {
    let resolveAction: (value: { message: string }) => void = () => undefined;
    removeAction.mockImplementation(() => new Promise((resolve) => { resolveAction = resolve; }));
    const user = userEvent.setup();
    render(<><a href="/dashboard">Dashboard</a><PolicyAccessControl policyId="policy-1" /></>);
    const trigger = screen.getByRole("button", { name: "Policy management options" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    const item = screen.getByRole("menuitem", { name: "Remove from account" });
    expect(document.activeElement).toBe(item);
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove from account" }));
    await user.keyboard("{Enter}");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeTruthy();
    resolveAction({ message: "Unable to remove policy." });
    await screen.findByText("Unable to remove policy.");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
