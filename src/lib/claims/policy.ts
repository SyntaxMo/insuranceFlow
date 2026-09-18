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
      .ilike("policy_number", normalized)
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

    if (data.user_id !== customerUserId) {
      const { data: link, error: linkError } = await supabase
        .from("customer_policy_links")
        .select("id")
        .eq("portal_user_id", customerUserId)
        .eq("policy_id", data.id)
        .maybeSingle();

      if (linkError) {
        console.error("Linked policy authorization failed:", linkError.message);
        return {
          ok: false,
          code: "SERVER",
          error: "We could not verify this policy right now. Please try again shortly.",
        };
      }
      if (!link) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "No policy linked to your account was found with that number.",
        };
      }
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

export async function verifyPolicyById(
  policyId: string,
  customerUserId: string,
): Promise<PolicyVerificationResult> {
  const normalized = policyId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return {
      ok: false,
      code: "INVALID",
      error: "Choose a valid policy before submitting your claim.",
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
      .eq("id", normalized)
      .maybeSingle();

    if (error) {
      console.error("Policy ID verification failed:", error.message);
      return {
        ok: false,
        code: "SERVER",
        error: "We could not verify this policy right now. Please try again shortly.",
      };
    }

    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "This policy is not available for your account.",
      };
    }

    if (data.user_id !== customerUserId) {
      const { data: link, error: linkError } = await supabase
        .from("customer_policy_links")
        .select("id")
        .eq("portal_user_id", customerUserId)
        .eq("policy_id", data.id)
        .maybeSingle();

      if (linkError) {
        console.error("Selected policy authorization failed:", linkError.message);
        return {
          ok: false,
          code: "SERVER",
          error: "We could not verify this policy right now. Please try again shortly.",
        };
      }
      if (!link) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "This policy is not available for your account.",
        };
      }
    }

    return evaluatePolicyEligibility(data as Policy);
  } catch (error) {
    console.error("Policy ID verification exception:", error);
    return {
      ok: false,
      code: "SERVER",
      error: "We could not verify this policy right now. Please try again shortly.",
    };
  }
}
