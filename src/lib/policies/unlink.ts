import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

const FINAL_CLAIM_STATUSES = new Set(["REJECTED", "CLOSED"]);

export type UnlinkPolicyResult =
  | { ok: true }
  | { ok: false; reason: "not_linked" | "active_claim" | "database" };

export async function unlinkCustomerPolicy({
  portalUserId,
  policyId,
}: {
  portalUserId: string;
  policyId: string;
}): Promise<UnlinkPolicyResult> {
  const supabase = createServiceRoleClient();
  const { data: link, error: linkError } = await supabase
    .from("customer_policy_links")
    .select("id")
    .eq("portal_user_id", portalUserId)
    .eq("policy_id", policyId)
    .maybeSingle();

  if (linkError) {
    console.error("Policy unlink authorization failed:", linkError.message);
    return { ok: false, reason: "database" };
  }
  if (!link) return { ok: false, reason: "not_linked" };

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .select("user_id")
    .eq("id", policyId)
    .maybeSingle();

  if (policyError) {
    console.error("Policy unlink ownership check failed:", policyError.message);
    return { ok: false, reason: "database" };
  }
  if (!policy || policy.user_id === portalUserId) {
    return { ok: false, reason: "not_linked" };
  }

  const { data: claims, error: claimError } = await supabase
    .from("claims")
    .select("status")
    .eq("policy_id", policyId);

  if (claimError) {
    console.error("Policy unlink claim check failed:", claimError.message);
    return { ok: false, reason: "database" };
  }

  const hasActiveClaim = (claims || []).some(
    (claim) => !FINAL_CLAIM_STATUSES.has(String(claim.status).toUpperCase()),
  );
  if (hasActiveClaim) return { ok: false, reason: "active_claim" };

  const { data: removed, error: deleteError } = await supabase
    .from("customer_policy_links")
    .delete()
    .eq("id", link.id)
    .eq("portal_user_id", portalUserId)
    .eq("policy_id", policyId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("Policy unlink failed:", deleteError.message);
    return { ok: false, reason: "database" };
  }
  if (!removed) return { ok: false, reason: "not_linked" };

  return { ok: true };
}
