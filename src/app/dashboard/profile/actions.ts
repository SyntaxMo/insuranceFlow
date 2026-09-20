"use server";

import { z } from "zod";
import { getProfileByAuthUserId } from "@/lib/auth/session";
import { authCallbackUrl } from "@/lib/auth/urls";
import { createServerClient } from "@/lib/supabase/server";

const emailChangeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your new email address.")
    .max(254, "Email address must be 254 characters or fewer.")
    .email("Enter a valid email address."),
});

export type EmailChangeState = {
  success?: boolean;
  pendingEmail?: string;
  message?: string;
  fields?: { email?: string[] };
};

export async function requestEmailChangeAction(
  _previous: EmailChangeState,
  formData: FormData,
): Promise<EmailChangeState> {
  const parsed = emailChangeSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fields: parsed.error.flatten().fieldErrors };
  }

  const authClient = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return { message: "Your session has expired. Sign in and try again." };
  }

  const profile = await getProfileByAuthUserId(user.id);
  if (!profile || profile.role !== "CUSTOMER") {
    return { message: "This account cannot change a customer email address." };
  }

  const currentEmail = user.email?.trim().toLowerCase();
  if (!currentEmail) {
    return { message: "We could not verify your current email. Please try again." };
  }
  if (parsed.data.email === currentEmail) {
    return { fields: { email: ["Enter an email different from your current email."] } };
  }

  const { error } = await authClient.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: authCallbackUrl({ intent: "email-change" }) },
  );

  if (error) {
    console.error("Customer email change request failed:", error.code || "AUTH_UPDATE_FAILED");
    return {
      message:
        "We could not send the verification email. Check the address and try again.",
    };
  }

  return { success: true, pendingEmail: parsed.data.email };
}
