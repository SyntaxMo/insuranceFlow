import { z } from "zod";

const email = z.string().trim().email("Enter a valid email address.");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

export const loginSchema = z.object({ email, password });

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(120, "Full name is too long."),
    email,
    phone: z
      .string()
      .trim()
      .regex(/^[+\d][\d\s()-]{6,}$/, "Enter a valid phone number."),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type SignupInput = z.input<typeof signupSchema>;

export function validateSignupFields(
  input: SignupInput,
): Record<string, string[]> {
  const result = signupSchema.safeParse(input);
  return result.success ? {} : result.error.flatten().fieldErrors;
}

export function prepareSignupSubmission(
  input: SignupInput,
  submissionInProgress: boolean,
): { shouldSubmit: boolean; fields: Record<string, string[]> } {
  if (submissionInProgress) return { shouldSubmit: false, fields: {} };
  const fields = validateSignupFields(input);
  return { shouldSubmit: Object.keys(fields).length === 0, fields };
}

export function friendlyAuthError(
  message: string,
  operation: "login" | "signup",
): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }
  if (normalized.includes("already") || normalized.includes("registered")) {
    return "An account with this email already exists.";
  }
  if (normalized.includes("rate") || normalized.includes("too many")) {
    return operation === "signup"
      ? "Too many signup attempts. Please wait before trying again."
      : "Too many sign-in attempts. Please wait before trying again.";
  }
  return "Authentication is unavailable right now. Please try again.";
}

export type AuthFormState = {
  message?: string;
  success?: boolean;
  fields?: Record<string, string[]>;
};
