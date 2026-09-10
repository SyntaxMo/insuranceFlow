import { describe, expect, it } from "vitest";
import {
  friendlyAuthError,
  loginSchema,
  prepareSignupSubmission,
  signupSchema,
} from "@/lib/auth/validation";

const validSignup = {
  fullName: "Test Customer",
  email: "customer@example.org",
  phone: "+973 3000 0000",
  password: "password1",
  confirmPassword: "password1",
};

describe("authentication validation", () => {
  it("accepts a valid login", () => {
    expect(loginSchema.safeParse({ email: "customer@example.org", password: "password1" }).success).toBe(true);
  });

  it("rejects an invalid email and short password", () => {
    expect(loginSchema.safeParse({ email: "invalid", password: "short" }).success).toBe(false);
  });

  it("accepts a valid customer signup without a role field", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("blocks mismatched passwords before submission", () => {
    const decision = prepareSignupSubmission(
      { ...validSignup, confirmPassword: "different1" },
      false,
    );
    expect(decision.shouldSubmit).toBe(false);
    expect(decision.fields.confirmPassword).toContain("Passwords do not match.");
  });

  it("blocks a short password before submission", () => {
    const decision = prepareSignupSubmission(
      { ...validSignup, password: "short", confirmPassword: "short" },
      false,
    );
    expect(decision.shouldSubmit).toBe(false);
    expect(decision.fields.password).toContain(
      "Password must be at least 8 characters.",
    );
  });

  it("blocks an invalid email before submission", () => {
    const decision = prepareSignupSubmission(
      { ...validSignup, email: "not-an-email" },
      false,
    );
    expect(decision.shouldSubmit).toBe(false);
    expect(decision.fields.email).toContain("Enter a valid email address.");
  });

  it("allows exactly one valid submission while locked", () => {
    expect(prepareSignupSubmission(validSignup, false).shouldSubmit).toBe(true);
    expect(prepareSignupSubmission(validSignup, true).shouldSubmit).toBe(false);
  });

  it("maps a Supabase rate limit to a signup-specific message", () => {
    expect(friendlyAuthError("email rate limit exceeded", "signup")).toBe(
      "Too many signup attempts. Please wait before trying again.",
    );
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({
      fullName: "Test Customer",
      email: "customer@example.org",
      phone: "+973 3000 0000",
      password: "password1",
      confirmPassword: "password2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain("Passwords do not match.");
    }
  });
});
