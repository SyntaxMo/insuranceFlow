// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/policies/actions", () => ({
  removeLinkedPolicyAction: vi.fn(),
}));

import { PolicyAccessControl } from "@/components/dashboard/PolicyAccessControl";

afterEach(cleanup);

describe("PolicyAccessControl", () => {
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
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove from account" })).toBeTruthy();
  });
});
