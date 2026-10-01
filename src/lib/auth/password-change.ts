import "server-only";

import { z } from "zod";
import { getProfileByAuthUserId, isStaffRole } from "@/lib/auth/session";
import { issuePasswordChangeCode, verifyAndConsumePasswordChangeCode } from "@/lib/auth/password-change-verification";
import { createServerClient } from "@/lib/supabase/server";

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

type PasswordChangeScope = "customer" | "staff";

async function authenticatedAccountForPasswordChange(scope: PasswordChangeScope) {
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
  if (!profile || (scope === "customer" ? profile.role !== "CUSTOMER" : !isStaffRole(profile.role))) {
    return {
      error: `This account cannot change a ${scope} password.`,
    } as const;
  }

  if (!user.email || !user.email_confirmed_at) {
    return {
      error: "A verified account email is required to change your password.",
    } as const;
  }

  return { authClient, user, profile } as const;
}

export async function requestPasswordChangeCode(
  scope: PasswordChangeScope,
  previous: PasswordCodeRequestState,
  formData: FormData,
): Promise<PasswordCodeRequestState> {
  void formData;
  const authentication = await authenticatedAccountForPasswordChange(scope);
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

export async function updatePassword(
  scope: PasswordChangeScope,
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

  const authentication = await authenticatedAccountForPasswordChange(scope);
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
      "Authenticated password update failed:",
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
