import "server-only";

import type { Policy } from "@/types/database";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  evaluatePolicyEligibility,
  type PolicyVerificationResult,
} from "@/lib/claims/policy-eligibility";

export type { PolicyVerificationResult };
export {
  evaluatePolicyEligibility,
  mapPolicyToSummary,
} from "@/lib/claims/policy-eligibility";

export async function verifyPolicyByNumber(
  policyNumber: string,
  customerUserId: string,
): Promise<PolicyVerificationResult> {
  const normalized = policyNumber.trim().toUpperCase();

  if (!normalized) {
    return {
      ok: false,
      code: "INVALID",
      error: "Enter a policy number to continue.",
    };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("policies")
      .select(
        `
        id,
        user_id,
        vehicle_id,
        policy_number,
        status,
        start_date,
        end_date,
        coverage_type,
        excess_amount,
        coverage_limit,
        vehicles (
          id,
          owner_id,
          make,
          model,
          year,
          plate_number
        )
      `,
      )
      .eq("policy_number", normalized)
      .eq("user_id", customerUserId)
      .maybeSingle();

    if (error) {
      console.error("Policy verification failed:", error.message);
      return {
        ok: false,
        code: "SERVER",
        error:
          "We could not verify this policy right now. Please try again shortly.",
      };
    }

    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "No policy linked to your account was found with that number.",
      };
    }

    return evaluatePolicyEligibility(data as Policy);
  } catch (err) {
    console.error("Policy verification exception:", err);
    return {
      ok: false,
      code: "SERVER",
      error:
        "We could not verify this policy right now. Please try again shortly.",
    };
  }
}
