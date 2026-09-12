import "server-only";

import { createHmac, randomInt } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  maskEmail,
  resolveExistingPolicyMatch,
} from "@/lib/policies/link-existing";

const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_COOLDOWN_SECONDS = 60;
export const MAX_OTP_ATTEMPTS = 5;
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "InsureFlow <noreply@insureflow.infaqbh.me>";

export type IssueOtpResult =
  | { ok: true; maskedEmail: string; cooldownSeconds: number }
  | { ok: false; reason: "policy" | "cooldown" | "configuration" | "delivery" | "database"; retryAfterSeconds?: number };

export function generateNumericOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashPolicyLinkOtp({
  otp,
  requestingUserId,
  policyId,
  secret,
}: {
  otp: string;
  requestingUserId: string;
  policyId: string;
  secret: string;
}): string {
  return createHmac("sha256", secret)
    .update(`${requestingUserId}:${policyId}:${otp}`)
    .digest("hex");
}

async function sendVerificationEmail(
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
        subject: "Verify your InsureFlow policy",
        text: `Your verification code is:\n\n${otp}\n\nThis code expires in 10 minutes. If you did not request this verification, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;color:#18324a;line-height:1.6"><h2 style="margin:0 0 16px">Verify your InsureFlow policy</h2><p>Your verification code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:20px 0">${otp}</p><p>This code expires in 10 minutes.</p><p style="color:#64748b;font-size:14px">If you did not request this verification, you can ignore this email.</p></div>`,
      }),
    });

    if (!response.ok) {
      console.error("Policy verification email failed:", {
        provider: "Resend",
        status: response.status,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Policy verification email exception:", {
      provider: "Resend",
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

export async function issuePolicyVerificationCode({
  requestingUserId,
  policyNumber,
  submittedEmail,
  now = new Date(),
}: {
  requestingUserId: string;
  policyNumber: string;
  submittedEmail: string;
  now?: Date;
}): Promise<IssueOtpResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const hashSecret = process.env.OTP_HASH_SECRET?.trim();
  if (!resendApiKey || !hashSecret) {
    console.error("Policy verification configuration missing:", {
      hasResendApiKey: Boolean(resendApiKey),
      hasOtpHashSecret: Boolean(hashSecret),
    });
    return { ok: false, reason: "configuration" };
  }

  const resolution = await resolveExistingPolicyMatch(
    policyNumber,
    submittedEmail,
  );
  if (!resolution) return { ok: false, reason: "policy" };

  const supabase = createServiceRoleClient();
  const { data: activeRows, error: cooldownError } = await supabase
    .from("policy_link_verifications")
    .select("id, created_at")
    .eq("requesting_user_id", requestingUserId)
    .eq("policy_id", resolution.policyId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (cooldownError) {
    console.error("Policy verification cooldown lookup failed:", cooldownError.message);
    return { ok: false, reason: "database" };
  }

  const newestActive = activeRows?.[0] as
    | { id: string; created_at: string }
    | undefined;
  if (newestActive) {
    const elapsedMs = now.getTime() - new Date(newestActive.created_at).getTime();
    const cooldownMs = OTP_COOLDOWN_SECONDS * 1000;
    if (Number.isFinite(elapsedMs) && elapsedMs < cooldownMs) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000)),
      };
    }
  }

  const { error: invalidateError } = await supabase
    .from("policy_link_verifications")
    .delete()
    .eq("requesting_user_id", requestingUserId)
    .eq("policy_id", resolution.policyId)
    .is("consumed_at", null);

  if (invalidateError) {
    console.error("Previous policy verification invalidation failed:", invalidateError.message);
    return { ok: false, reason: "database" };
  }

  const otp = generateNumericOtp();
  const otpHash = hashPolicyLinkOtp({
    otp,
    requestingUserId,
    policyId: resolution.policyId,
    secret: hashSecret,
  });
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  const { data: verification, error: insertError } = await supabase
    .from("policy_link_verifications")
    .insert({
      requesting_user_id: requestingUserId,
      policy_id: resolution.policyId,
      target_email: resolution.targetEmail,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempt_count: 0,
      consumed_at: null,
    })
    .select("id")
    .single();

  if (insertError || !verification) {
    console.error(
      "Policy verification record creation failed:",
      insertError?.message || "No verification record returned",
    );
    if (insertError?.code === "23505") {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: OTP_COOLDOWN_SECONDS,
      };
    }
    return { ok: false, reason: "database" };
  }

  const delivered = await sendVerificationEmail(
    resolution.targetEmail,
    otp,
    resendApiKey,
  );
  if (!delivered) {
    const { error: cleanupError } = await supabase
      .from("policy_link_verifications")
      .delete()
      .eq("id", verification.id);
    if (cleanupError) {
      console.error("Failed verification cleanup failed:", cleanupError.message);
    }
    return { ok: false, reason: "delivery" };
  }

  return {
    ok: true,
    maskedEmail: maskEmail(resolution.targetEmail),
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
  };
}
