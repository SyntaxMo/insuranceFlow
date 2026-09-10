// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignupForm } from "@/components/auth/AuthForms";

const { signupActionMock, loginActionMock } = vi.hoisted(() => ({
  signupActionMock: vi.fn(),
  loginActionMock: vi.fn(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signupAction: signupActionMock,
  loginAction: loginActionMock,
}));

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Test Customer" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "customer@example.org" },
  });
  fireEvent.change(screen.getByLabelText("Phone"), {
    target: { value: "+973 3000 0000" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password1" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "password1" },
  });
}

function expectValues(values: {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}) {
  for (const [name, value] of Object.entries(values)) {
    expect(document.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value).toBe(value);
  }
}

describe("SignupForm", () => {
  beforeEach(() => {
    signupActionMock.mockReset();
    loginActionMock.mockReset();
    signupActionMock.mockResolvedValue({});
  });

  afterEach(cleanup);

  it("keeps every value and makes no request for a password mismatch", () => {
    render(<SignupForm />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create customer account" }));

    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(signupActionMock).not.toHaveBeenCalled();
    expectValues({
      fullName: "Test Customer",
      email: "customer@example.org",
      phone: "+973 3000 0000",
      password: "password1",
      confirmPassword: "different1",
    });
  });

  it("submits once after only the confirmation password is corrected", async () => {
    render(<SignupForm />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create customer account" }));
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create customer account" }));

    await waitFor(() => expect(signupActionMock).toHaveBeenCalledTimes(1));
  });

  it.each([
    {
      label: "short password",
      field: "Password",
      value: "short",
      confirmation: "short",
      error: "Password must be at least 8 characters.",
    },
    {
      label: "invalid email",
      field: "Email",
      value: "not-an-email",
      confirmation: "password1",
      error: "Enter a valid email address.",
    },
  ])("blocks $label locally and preserves the form", ({ field, value, confirmation, error }) => {
    render(<SignupForm />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(field), { target: { value } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: confirmation },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create customer account" }));

    expect(screen.getByText(error)).toBeTruthy();
    expect(signupActionMock).not.toHaveBeenCalled();
    expect((screen.getByLabelText(field) as HTMLInputElement).value).toBe(value);
  });

  it("turns a double click into one signup action", async () => {
    let finish: ((value: object) => void) | undefined;
    signupActionMock.mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    render(<SignupForm />);
    fillValidForm();
    const button = screen.getByRole("button", { name: "Create customer account" });

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(signupActionMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Creating account..." })).toHaveProperty("disabled", true);
    finish?.({});
  });

  it("keeps values and displays a friendly Supabase rate-limit error", async () => {
    signupActionMock.mockResolvedValue({
      message: "Too many signup attempts. Please wait before trying again.",
    });
    render(<SignupForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create customer account" }));

    expect(await screen.findByText("Too many signup attempts. Please wait before trying again.")).toBeTruthy();
    expect(signupActionMock).toHaveBeenCalledTimes(1);
    expectValues({
      fullName: "Test Customer",
      email: "customer@example.org",
      phone: "+973 3000 0000",
      password: "password1",
      confirmPassword: "password1",
    });
  });
});
