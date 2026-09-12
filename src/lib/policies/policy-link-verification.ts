import "server-only";

import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveExistingPolicyMatch } from "@/lib/policies/link-existing";
import {
  hashPolicyLinkOtp,
  MAX_OTP_ATTEMPTS,
} from "@/lib/policies/policy-link-otp";

export type VerifyPolicyLinkResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "policy"
        | "invalid"
        | "expired"
        | "incorrect"
        | "attempts"
        | "linked_other"
        | "configuration"
        | "database";
    };

type VerificationRow = {
  id: string;
  otp_hash: string;
  expires_at: string;
  attempt_count: number;
};

export function otpHashesMatch(expectedHex: string, actualHex: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expectedHex) || !/^[0-9a-f]{64}$/i.test(actualHex)) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function verifyPolicyLinkCode({
  requestingUserId,
  policyNumber,
  submittedEmail,
  otp,
  now = new Date(),
}: {
  requestingUserId: string;
  policyNumber: string;
  submittedEmail: string;
  otp: string;
  now?: Date;
}): Promise<VerifyPolicyLinkResult> {
  if (!/^\d{6}$/.test(otp)) return { ok: false, reason: "invalid" };

  const hashSecret = process.env.OTP_HASH_SECRET?.trim();
  if (!hashSecret) {
    console.error("Policy verification configuration missing:", {
      hasOtpHashSecret: false,
    });
    return { ok: false, reason: "configuration" };
  }

  const resolution = await resolveExistingPolicyMatch(policyNumber, submittedEmail);
  if (!resolution) return { ok: false, reason: "policy" };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("policy_link_verifications")
    .select("id, otp_hash, expires_at, attempt_count")
    .eq("requesting_user_id", requestingUserId)
    .eq("policy_id", resolution.policyId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Policy verification lookup failed:", error.message);
    return { ok: false, reason: "database" };
  }

  const verification = data as VerificationRow | null;
  if (!verification || verification.attempt_count >= MAX_OTP_ATTEMPTS) {
    return { ok: false, reason: "invalid" };
  }

  const expiresAt = new Date(verification.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || now.getTime() > expiresAt) {
    return { ok: false, reason: "expired" };
  }

  const submittedHash = hashPolicyLinkOtp({
    otp,
    requestingUserId,
    policyId: resolution.policyId,
    secret: hashSecret,
  });

  if (!otpHashesMatch(verification.otp_hash, submittedHash)) {
    const { data: attemptCount, error: incrementError } = await supabase.rpc(
      "increment_policy_link_verification_attempt",
      {
        p_verification_id: verification.id,
        p_requesting_user_id: requestingUserId,
      },
    );
    if (incrementError) {
      console.error("Policy verification attempt update failed:", incrementError.message);
      return { ok: false, reason: "database" };
    }
    if (typeof attemptCount !== "number") return { ok: false, reason: "invalid" };
    return attemptCount >= MAX_OTP_ATTEMPTS
      ? { ok: false, reason: "attempts" }
      : { ok: false, reason: "incorrect" };
  }

  const { data: completion, error: completionError } = await supabase.rpc(
    "complete_policy_link_verification",
    {
      p_verification_id: verification.id,
      p_requesting_user_id: requestingUserId,
      p_policy_id: resolution.policyId,
    },
  );
  if (completionError) {
    console.error("Policy linking transaction failed:", completionError.message);
    return { ok: false, reason: "database" };
  }

  if (completion === "linked" || completion === "already_linked") {
    return { ok: true };
  }
  if (completion === "linked_other") return { ok: false, reason: "linked_other" };
  if (completion === "expired") return { ok: false, reason: "expired" };
  if (completion === "attempts") return { ok: false, reason: "attempts" };
  return { ok: false, reason: "invalid" };
}
