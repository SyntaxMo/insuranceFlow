"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfileByAuthUserId } from "@/lib/auth/session";
import {
  issuePasswordChangeCode,
  verifyAndConsumePasswordChangeCode,
} from "@/lib/auth/password-change-verification";
import { authCallbackUrl } from "@/lib/auth/urls";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";

const emailChangeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your new email address.")
    .max(254, "Email address must be 254 characters or fewer.")
    .email("Enter a valid email address."),
});

const fullNameChangeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(100, "Full name must be 100 characters or fewer."),
});

const passwordChangeSchema = z
  .object({
    verificationCode: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "Enter the 8-digit verification code."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type EmailChangeState = {
  success?: boolean;
  pendingEmail?: string;
  message?: string;
  fields?: { email?: string[] };
};

export type FullNameChangeState = {
  success?: boolean;
  fullName?: string;
  message?: string;
  fields?: { fullName?: string[] };
};

export type PasswordCodeRequestState = {
  success?: boolean;
  message?: string;
};

export type PasswordChangeState = {
  success?: boolean;
  message?: string;
  fields?: {
    verificationCode?: string[];
    password?: string[];
    confirmPassword?: string[];
  };
};

async function authenticatedCustomerForPasswordChange() {
  const authClient = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      error: "Your session has expired. Sign in and try again.",
    } as const;
  }

  const profile = await getProfileByAuthUserId(user.id);
  if (!profile || profile.role !== "CUSTOMER") {
    return {
      error: "This account cannot change a customer password.",
    } as const;
  }

  if (!user.email || !user.email_confirmed_at) {
    return {
      error: "A verified account email is required to change your password.",
    } as const;
  }

  return { authClient, user, profile } as const;
}

export async function requestPasswordChangeCodeAction(
  previous: PasswordCodeRequestState,
  formData: FormData,
): Promise<PasswordCodeRequestState> {
  void formData;
  const authentication = await authenticatedCustomerForPasswordChange();
  if ("error" in authentication) {
    return { message: authentication.error };
  }

  const result = await issuePasswordChangeCode({
    portalUserId: authentication.profile.id,
    authUserId: authentication.user.id,
    targetEmail: authentication.user.email!,
  });
  if (!result.ok) {
    return {
      success: previous.success,
      message:
        result.reason === "cooldown"
          ? "Please wait before requesting another code."
          : "We could not send a verification code. Please try again.",
    };
  }

  return { success: true };
}

export async function updatePasswordAction(
  _previous: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const parsed = passwordChangeSchema.safeParse({
    verificationCode: formData.get("verificationCode"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { fields: parsed.error.flatten().fieldErrors };
  }

  const authentication = await authenticatedCustomerForPasswordChange();
  if ("error" in authentication) {
    return { message: authentication.error };
  }

  const verification = await verifyAndConsumePasswordChangeCode({
    portalUserId: authentication.profile.id,
    authUserId: authentication.user.id,
    otp: parsed.data.verificationCode,
  });
  if (!verification.ok) {
    if (verification.reason === "incorrect" || verification.reason === "invalid") {
      return { fields: { verificationCode: ["The verification code is incorrect."] } };
    }
    if (verification.reason === "expired") {
      return {
        fields: {
          verificationCode: ["The verification code has expired. Request a new code."],
        },
      };
    }
    if (verification.reason === "attempts") {
      return {
        fields: {
          verificationCode: ["Too many incorrect attempts. Request a new code."],
        },
      };
    }
    if (verification.reason === "used") {
      return {
        fields: {
          verificationCode: ["This verification code has already been used. Request a new code."],
        },
      };
    }
    return { message: "We could not verify this code. Please try again." };
  }

  const { error } = await authentication.authClient.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    console.error(
      "Customer password update failed:",
      error.code || "PASSWORD_UPDATE_FAILED",
    );

    if (error.code === "weak_password") {
      return {
        fields: {
          password: ["Choose a stronger password that meets the account requirements."],
        },
      };
    }
    if (error.code === "same_password") {
      return {
        fields: { password: ["Choose a password different from your current password."] },
      };
    }
    if (error.code === "session_expired" || error.code === "session_not_found") {
      return { message: "Your session has expired. Sign in and try again." };
    }
    if (error.code === "reauthentication_needed") {
      return { message: "Sign in again, then request a new code to change your password." };
    }

    return { message: "We could not update your password. Please try again." };
  }

  return { success: true };
}

export async function updateFullNameAction(
  _previous: FullNameChangeState,
  formData: FormData,
): Promise<FullNameChangeState> {
  const parsed = fullNameChangeSchema.safeParse({
    fullName: formData.get("fullName"),
  });
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
    return { message: "This account cannot update a customer profile." };
  }

  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient
    .from("users")
    .update({ full_name: parsed.data.fullName })
    .eq("id", profile.id)
    .eq("auth_user_id", user.id)
    .select("full_name")
    .single();

  if (error || !data) {
    console.error(
      "Customer full name update failed:",
      error?.code || "PROFILE_UPDATE_FAILED",
    );
    return { message: "We could not update your name. Please try again." };
  }

  const { error: metadataError } = await authClient.auth.updateUser({
    data: { full_name: parsed.data.fullName },
  });
  if (metadataError) {
    console.error(
      "Customer Auth name metadata synchronization failed:",
      metadataError.code || "AUTH_METADATA_UPDATE_FAILED",
    );
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { success: true, fullName: data.full_name as string };
}

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
