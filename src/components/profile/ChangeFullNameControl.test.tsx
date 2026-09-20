// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateFullNameAction: vi.fn() }));

vi.mock("@/app/dashboard/profile/actions", () => ({
  updateFullNameAction: mocks.updateFullNameAction,
}));

import { ChangeFullNameControl } from "@/components/profile/ChangeFullNameControl";

describe("ChangeFullNameControl", () => {
  beforeEach(() => {
    mocks.updateFullNameAction.mockResolvedValue({
      success: true,
      fullName: "Maryam O'Neil-Sayed",
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders an accessible edit icon and opens a pre-filled dialog", async () => {
    const user = userEvent.setup();
    render(<ChangeFullNameControl currentName="Mohammed Essam" />);
    const trigger = screen.getByRole("button", { name: "Change full name" });
    expect(trigger.querySelector('[data-testid="pencil-icon"]')).toBeTruthy();

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Change full name" })).toBeTruthy();
    const input = screen.getByLabelText("Full name") as HTMLInputElement;
    expect(input.value).toBe("Mohammed Essam");
    expect(document.activeElement).toBe(input);
  });

  it("Cancel and Escape close the dialog and restore focus", async () => {
    const user = userEvent.setup();
    render(<ChangeFullNameControl currentName="Mohammed Essam" />);
    const trigger = screen.getByRole("button", { name: "Change full name" });

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("submits only the full name and announces success", async () => {
    const user = userEvent.setup();
    render(<ChangeFullNameControl currentName="Mohammed Essam" />);
    await user.click(screen.getByRole("button", { name: "Change full name" }));
    const input = screen.getByLabelText("Full name");
    await user.clear(input);
    await user.type(input, "Maryam O'Neil-Sayed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Name updated successfully");
    expect(mocks.updateFullNameAction).toHaveBeenCalledOnce();
    const submitted = mocks.updateFullNameAction.mock.calls[0]?.[1] as FormData;
    expect(Array.from(submitted.keys())).toEqual(["fullName"]);
    expect(submitted.get("fullName")).toBe("Maryam O'Neil-Sayed");
  });
});
