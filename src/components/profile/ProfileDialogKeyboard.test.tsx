// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ name: vi.fn(), email: vi.fn(), password: vi.fn(), request: vi.fn() }));
vi.mock("@/app/dashboard/profile/actions", () => ({
  updateFullNameAction: actions.name, requestEmailChangeAction: actions.email,
  requestPasswordChangeCodeAction: actions.request, updatePasswordAction: actions.password,
}));
import { ChangeFullNameControl } from "./ChangeFullNameControl";
import { ChangeEmailControl } from "./ChangeEmailControl";
import { ChangePasswordControl } from "./ChangePasswordControl";

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("profile dialog keyboard boundaries", () => {
  it.each([
    { kind: "name", label: "Change full name", submit: "Save changes", action: actions.name },
    { kind: "email", label: "Change email", submit: "Send verification", action: actions.email },
    { kind: "password", label: "Change password", submit: "Send code", action: actions.request },
  ])("keeps $kind focus inside during pending, error, and dismissal", async ({ kind, label, submit, action }) => {
    let finish: (result: object) => void = () => undefined;
    action.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<><a href="/dashboard">Dashboard</a>{kind === "name"
      ? <ChangeFullNameControl currentName="Maya Ali" />
      : kind === "email" ? <ChangeEmailControl currentEmail="maya@example.com" />
        : <ChangePasswordControl currentEmail="maya@example.com" />}</>);
    await user.tab();
    await user.tab();
    const trigger = screen.getByRole("button", { name: label });
    expect(document.activeElement).toBe(trigger);
    await user.keyboard(" ");
    const dialog = screen.getByRole("dialog");
    const field = kind === "name" ? screen.getByLabelText("Full name")
      : kind === "email" ? screen.getByLabelText("New email address") : null;
    if (field) {
      expect(document.activeElement).toBe(field);
      if (kind === "email") await user.type(field, "new@example.com");
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(screen.getByRole("button", { name: submit }));
      await user.tab();
      expect(document.activeElement).toBe(field);
      await user.tab();
      await user.tab();
    }
    await user.keyboard("{Enter}");
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBe(dialog);
    finish({ message: "Please correct the field.", fields: kind === "name" ? { fullName: ["Invalid name."] } : kind === "email" ? { email: ["Invalid email."] } : undefined });
    await screen.findByText("Please correct the field.");
    if (field) expect(document.activeElement).toBe(field);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
