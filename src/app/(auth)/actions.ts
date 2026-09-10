"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  friendlyAuthError,
  loginSchema,
  signupSchema,
  type AuthFormState,
} from "@/lib/auth/validation";
import { routeForRole } from "@/lib/auth/session";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

function fieldsFromError(error: { flatten(): { fieldErrors: Record<string, string[]> } }) {
  return error.flatten().fieldErrors;
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fields: fieldsFromError(parsed.error) };

  const authClient = await createServerClient();
  const { data, error } = await authClient.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return {
      message: friendlyAuthError(error?.message || "Sign in failed", "login"),
    };
  }

  const serviceClient = createServiceRoleClient();
  const { data: profile, error: profileError } = await serviceClient
    .from("users")
    .select("role")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await authClient.auth.signOut();
    console.error("Login profile lookup failed:", profileError?.message || "Profile missing");
    return {
      message:
        "Your account is not linked to an InsureFlow profile. Contact support.",
    };
  }

  const role = profile.role as UserRole;
  if (!["CUSTOMER", "CLAIMS_OFFICER", "ADMIN"].includes(role)) {
    await authClient.auth.signOut();
    return { message: "Your account role is not supported." };
  }

  revalidatePath("/", "layout");
  redirect(routeForRole(role));
}

export async function signupAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fields: fieldsFromError(parsed.error) };

  const { fullName, email, phone, password } = parsed.data;
  const authClient = await createServerClient();
  const { data, error } = await authClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });

  if (error || !data.user) {
    return {
      message: friendlyAuthError(error?.message || "Sign up failed", "signup"),
    };
  }

  if (data.user.identities?.length === 0) {
    await authClient.auth.signOut();
    return { message: "An account with this email already exists." };
  }

  const serviceClient = createServiceRoleClient();
  const { error: profileError } = await serviceClient.from("users").insert({
    full_name: fullName,
    email,
    phone,
    role: "CUSTOMER",
    auth_user_id: data.user.id,
  });

  if (profileError) {
    console.error("Customer profile creation failed:", profileError.message);
    await serviceClient.auth.admin.deleteUser(data.user.id);
    await authClient.auth.signOut();
    if (profileError.code === "23505") {
      return { message: "An account with this email already exists." };
    }
    return { message: "We could not finish creating your account. Please try again." };
  }

  if (!data.session) {
    return {
      success: true,
      message: "Account created. Check your email to confirm it, then sign in.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
