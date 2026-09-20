import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const PASSWORD_CHANGE_OTP_LENGTH = 8;
export const PASSWORD_CHANGE_OTP_COOLDOWN_SECONDS = 60;
export const MAX_PASSWORD_CHANGE_OTP_ATTEMPTS = 5;
const PASSWORD_CHANGE_OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "InsureFlow <noreply@insureflow.infaqbh.me>";

type VerificationRow = {
  id: string;
  otp_hash: string;
  expires_at: string;
  attempt_count: number;
};

export type IssuePasswordChangeCodeResult =
  | { ok: true; cooldownSeconds: number }
  | {
      ok: false;
      reason: "cooldown" | "configuration" | "delivery" | "database";
      retryAfterSeconds?: number;
    };

export type VerifyPasswordChangeCodeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid"
        | "incorrect"
        | "expired"
        | "attempts"
        | "used"
        | "configuration"
        | "database";
    };

export function generatePasswordChangeOtp(): string {
  return randomInt(0, 100_000_000).toString().padStart(PASSWORD_CHANGE_OTP_LENGTH, "0");
}

export function hashPasswordChangeOtp({
  otp,
  portalUserId,
  authUserId,
  secret,
}: {
  otp: string;
  portalUserId: string;
  authUserId: string;
  secret: string;
}): string {
  return createHmac("sha256", secret)
    .update(`${portalUserId}:${authUserId}:${otp}`)
    .digest("hex");
}

function hashesMatch(expectedHex: string, actualHex: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expectedHex) || !/^[0-9a-f]{64}$/i.test(actualHex)) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function sendPasswordChangeCode(
  targetEmail: string,
  otp: string,
  apiKey: string,
): Promise<boolean> {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [targetEmail],
        subject: "Your InsureFlow password verification code",
        text: `Your password verification code is:\n\n${otp}\n\nThis code expires in 10 minutes. If you did not request a password change, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;color:#18324a;line-height:1.6"><h2 style="margin:0 0 16px">Verify your password change</h2><p>Use this verification code to continue:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:20px 0">${otp}</p><p>This code expires in 10 minutes.</p><p style="color:#64748b;font-size:14px">If you did not request a password change, you can ignore this email.</p></div>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Password verification email failed:", {
        provider: "Resend",
        status: response.status,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Password verification email exception:", {
      provider: "Resend",
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

export async function issuePasswordChangeCode({
  portalUserId,
  authUserId,
  targetEmail,
  now = new Date(),
}: {
  portalUserId: string;
  authUserId: string;
  targetEmail: string;
  now?: Date;
}): Promise<IssuePasswordChangeCodeResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const hashSecret = process.env.OTP_HASH_SECRET?.trim();
  if (!resendApiKey || !hashSecret) {
    console.error("Password verification configuration missing:", {
      hasResendApiKey: Boolean(resendApiKey),
      hasOtpHashSecret: Boolean(hashSecret),
    });
    return { ok: false, reason: "configuration" };
  }

  const supabase = createServiceRoleClient();
  const { data: activeRows, error: lookupError } = await supabase
    .from("password_change_verifications")
    .select("id, created_at")
    .eq("portal_user_id", portalUserId)
    .eq("auth_user_id", authUserId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (lookupError) {
    console.error("Password verification cooldown lookup failed:", {
      code: lookupError.code || "DATABASE_ERROR",
    });
    return { ok: false, reason: "database" };
  }

  const active = activeRows?.[0] as { id: string; created_at: string } | undefined;
  if (active) {
    const elapsedMs = now.getTime() - new Date(active.created_at).getTime();
    const cooldownMs = PASSWORD_CHANGE_OTP_COOLDOWN_SECONDS * 1000;
    if (Number.isFinite(elapsedMs) && elapsedMs < cooldownMs) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000)),
      };
    }
  }

  const { error: invalidateError } = await supabase
    .from("password_change_verifications")
    .update({ consumed_at: now.toISOString() })
    .eq("portal_user_id", portalUserId)
    .eq("auth_user_id", authUserId)
    .is("consumed_at", null);
  if (invalidateError) {
    console.error("Previous password verification invalidation failed:", {
      code: invalidateError.code || "DATABASE_ERROR",
    });
    return { ok: false, reason: "database" };
  }

  const otp = generatePasswordChangeOtp();
  const { data: verification, error: insertError } = await supabase
    .from("password_change_verifications")
    .insert({
      portal_user_id: portalUserId,
      auth_user_id: authUserId,
      target_email: targetEmail.trim().toLowerCase(),
      otp_hash: hashPasswordChangeOtp({ otp, portalUserId, authUserId, secret: hashSecret }),
      expires_at: new Date(now.getTime() + PASSWORD_CHANGE_OTP_TTL_MS).toISOString(),
      attempt_count: 0,
      consumed_at: null,
    })
    .select("id")
    .single();

  if (insertError || !verification) {
    console.error("Password verification record creation failed:", {
      code: insertError?.code || "NO_RECORD",
    });
    return {
      ok: false,
      reason: insertError?.code === "23505" ? "cooldown" : "database",
      retryAfterSeconds:
        insertError?.code === "23505" ? PASSWORD_CHANGE_OTP_COOLDOWN_SECONDS : undefined,
    };
  }

  if (!(await sendPasswordChangeCode(targetEmail, otp, resendApiKey))) {
    const { error: cleanupError } = await supabase
      .from("password_change_verifications")
      .delete()
      .eq("id", verification.id);
    if (cleanupError) {
      console.error("Failed password verification cleanup failed:", {
        code: cleanupError.code || "DATABASE_ERROR",
      });
    }
    return { ok: false, reason: "delivery" };
  }

  return { ok: true, cooldownSeconds: PASSWORD_CHANGE_OTP_COOLDOWN_SECONDS };
}

export async function verifyAndConsumePasswordChangeCode({
  portalUserId,
  authUserId,
  otp,
  now = new Date(),
}: {
  portalUserId: string;
  authUserId: string;
  otp: string;
  now?: Date;
}): Promise<VerifyPasswordChangeCodeResult> {
  const hashSecret = process.env.OTP_HASH_SECRET?.trim();
  if (!hashSecret) {
    console.error("Password verification configuration missing:", { hasOtpHashSecret: false });
    return { ok: false, reason: "configuration" };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("password_change_verifications")
    .select("id, otp_hash, expires_at, attempt_count")
    .eq("portal_user_id", portalUserId)
    .eq("auth_user_id", authUserId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Password verification lookup failed:", {
      code: error.code || "DATABASE_ERROR",
    });
    return { ok: false, reason: "database" };
  }

  const verification = data as VerificationRow | null;
  if (!verification) return { ok: false, reason: "invalid" };
  if (verification.attempt_count >= MAX_PASSWORD_CHANGE_OTP_ATTEMPTS) {
    return { ok: false, reason: "attempts" };
  }

  const expiresAt = new Date(verification.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || now.getTime() > expiresAt) {
    await supabase.rpc("consume_password_change_verification", {
      p_verification_id: verification.id,
      p_portal_user_id: portalUserId,
      p_auth_user_id: authUserId,
    });
    return { ok: false, reason: "expired" };
  }

  const validFormat = new RegExp(`^\\d{${PASSWORD_CHANGE_OTP_LENGTH}}$`).test(otp);
  const submittedHash = validFormat
    ? hashPasswordChangeOtp({ otp, portalUserId, authUserId, secret: hashSecret })
    : "";
  if (!validFormat || !hashesMatch(verification.otp_hash, submittedHash)) {
    const { data: attemptCount, error: attemptError } = await supabase.rpc(
      "increment_password_change_verification_attempt",
      {
        p_verification_id: verification.id,
        p_portal_user_id: portalUserId,
        p_auth_user_id: authUserId,
      },
    );
    if (attemptError) {
      console.error("Password verification attempt update failed:", {
        code: attemptError.code || "DATABASE_ERROR",
      });
      return { ok: false, reason: "database" };
    }
    return typeof attemptCount === "number" && attemptCount >= MAX_PASSWORD_CHANGE_OTP_ATTEMPTS
      ? { ok: false, reason: "attempts" }
      : { ok: false, reason: validFormat ? "incorrect" : "invalid" };
  }

  const { data: result, error: consumeError } = await supabase.rpc(
    "consume_password_change_verification",
    {
      p_verification_id: verification.id,
      p_portal_user_id: portalUserId,
      p_auth_user_id: authUserId,
    },
  );
  if (consumeError) {
    console.error("Password verification consumption failed:", {
      code: consumeError.code || "DATABASE_ERROR",
    });
    return { ok: false, reason: "database" };
  }
  if (result === "consumed") return { ok: true };
  if (result === "expired") return { ok: false, reason: "expired" };
  if (result === "attempts") return { ok: false, reason: "attempts" };
  if (result === "used") return { ok: false, reason: "used" };
  return { ok: false, reason: "invalid" };
}
