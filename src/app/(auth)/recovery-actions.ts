"use server";

import { createServerClient } from "@/lib/supabase/server";
import { authCallbackUrl } from "@/lib/auth/urls";
import { clearRecoveryAuthorization, getRecoveryClient } from "@/lib/auth/recovery";
import { recoveryEmailSchema, recoveryPasswordSchema, type AuthFormState } from "@/lib/auth/validation";

export async function requestPasswordReset(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = recoveryEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };
  try {
    const client = await createServerClient();
    await client.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: authCallbackUrl({ intent: "recovery" }),
    });
  } catch {
    // Do not expose account existence, delivery failures, or provider details.
  }
  return { success: true, message: "If an account exists for that email, we’ve sent a password reset link." };
}

export async function resetPassword(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const client = await getRecoveryClient();
  if (!client) return { message: "This password reset link is invalid or has expired. Request a new reset link." };
  const parsed = recoveryPasswordSchema.safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };
  try {
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) {
      if (error.code === "weak_password" || error.code === "same_password") {
        return { fields: { password: ["Your new password must be different from your current password."] } };
      }
      if (error.status === 429) return { message: "Please wait before trying again." };
      return { message: "We couldn’t update your password. Try again or request a new reset link." };
    }
  } catch {
    return { message: "We couldn’t update your password. Try again or request a new reset link." };
  }
  await clearRecoveryAuthorization();
  // Recovery ends at sign-in; leave other tabs/sessions to Supabase's own policy.
  try { await client.auth.signOut({ scope: "local" }); } catch { /* Password update already succeeded. */ }
  return { success: true };
}
