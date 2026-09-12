"use server";

import { z } from "zod";
import { requireCustomer } from "@/lib/auth/session";
import {
  findExistingPolicyMatch,
  normalizeEmail,
  normalizePolicyNumber,
  POLICY_LOOKUP_ERROR,
  type VerifiedPolicyMatch,
} from "@/lib/policies/link-existing";
import { issuePolicyVerificationCode } from "@/lib/policies/policy-link-otp";
import { verifyPolicyLinkCode } from "@/lib/policies/policy-link-verification";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const policyLookupSchema = z.object({
  policyNumber: z
    .string()
    .trim()
    .min(1, "Enter your policy number.")
    .max(64, "Policy number is too long.")
    .regex(
      /^[A-Za-z0-9\s/-]+$/,
      "Enter a valid policy number.",
    ),
  email: z.string().trim().email("Enter a valid email address."),
});

export type PolicyLookupState = {
  fields?: Record<string, string[]>;
  message?: string;
  match?: VerifiedPolicyMatch;
  lookup?: { policyNumber: string; email: string };
};

export type SendPolicyCodeState = {
  sent?: boolean;
  maskedEmail?: string;
  cooldownSeconds?: number;
  cooldownToken?: number;
  message?: string;
};

export type VerifyPolicyCodeState = {
  fieldError?: string;
  message?: string;
};

const verificationCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Enter the 6-digit verification code.");

export async function lookupExistingPolicyAction(
  _previous: PolicyLookupState,
  formData: FormData,
): Promise<PolicyLookupState> {
  // Server Actions are public endpoints: authenticate and authorize every call.
  await requireCustomer();

  const parsed = policyLookupSchema.safeParse({
    policyNumber: formData.get("policyNumber"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { fields: parsed.error.flatten().fieldErrors };
  }

  try {
    const match = await findExistingPolicyMatch(
      parsed.data.policyNumber,
      parsed.data.email,
    );
    return match
      ? {
          match,
          lookup: {
            policyNumber: normalizePolicyNumber(parsed.data.policyNumber),
            email: normalizeEmail(parsed.data.email),
          },
        }
      : { message: POLICY_LOOKUP_ERROR };
  } catch (error) {
    console.error(
      "Existing policy lookup exception:",
      error instanceof Error ? error.message : "Unknown server error",
    );
    return { message: POLICY_LOOKUP_ERROR };
  }
}

export async function sendPolicyVerificationCodeAction(
  _previous: SendPolicyCodeState,
  formData: FormData,
): Promise<SendPolicyCodeState> {
  const customer = await requireCustomer();
  const parsed = policyLookupSchema.safeParse({
    policyNumber: formData.get("policyNumber"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { message: POLICY_LOOKUP_ERROR };

  try {
    const result = await issuePolicyVerificationCode({
      requestingUserId: customer.id,
      policyNumber: parsed.data.policyNumber,
      submittedEmail: parsed.data.email,
    });

    if (result.ok) {
      return {
        sent: true,
        maskedEmail: result.maskedEmail,
        cooldownSeconds: result.cooldownSeconds,
        cooldownToken: Date.now(),
      };
    }
    if (result.reason === "cooldown") {
      return {
        ..._previous,
        message: "Please wait before requesting another verification code.",
        cooldownSeconds: result.retryAfterSeconds || 60,
        cooldownToken: Date.now(),
      };
    }
    if (result.reason === "policy") return { message: POLICY_LOOKUP_ERROR };
    return {
      ..._previous,
      message:
        "We couldn't send a verification code right now. Please try again.",
    };
  } catch (error) {
    console.error(
      "Policy verification send exception:",
      error instanceof Error ? error.message : "Unknown server error",
    );
    return {
      ..._previous,
      message:
        "We couldn't send a verification code right now. Please try again.",
    };
  }
}

export async function verifyPolicyCodeAction(
  _previous: VerifyPolicyCodeState,
  formData: FormData,
): Promise<VerifyPolicyCodeState> {
  const customer = await requireCustomer();
  const lookup = policyLookupSchema.safeParse({
    policyNumber: formData.get("policyNumber"),
    email: formData.get("email"),
  });
  const code = verificationCodeSchema.safeParse(formData.get("verificationCode"));

  if (!code.success) {
    return { fieldError: code.error.issues[0]?.message };
  }
  if (!lookup.success) return { message: POLICY_LOOKUP_ERROR };

  try {
    const result = await verifyPolicyLinkCode({
      requestingUserId: customer.id,
      policyNumber: lookup.data.policyNumber,
      submittedEmail: lookup.data.email,
      otp: code.data,
    });

    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        policy: "This verification code is no longer valid. Request a new code.",
        invalid: "This verification code is no longer valid. Request a new code.",
        expired: "This verification code has expired. Request a new code.",
        incorrect: "The verification code is incorrect.",
        attempts: "Too many incorrect attempts. Request a new verification code.",
        linked_other: "This policy is already linked to another account.",
        configuration: "We couldn't verify the code right now. Please try again.",
        database: "We couldn't verify the code right now. Please try again.",
      };
      return { message: messages[result.reason] };
    }
  } catch (error) {
    console.error(
      "Policy verification exception:",
      error instanceof Error ? error.message : "Unknown server error",
    );
    return { message: "We couldn't verify the code right now. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?policyLinked=1");
}
