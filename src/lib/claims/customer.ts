import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { CUSTOMER_VISIBLE_HISTORY_ACTIONS } from "@/lib/claims/workflow";
import type {
  Claim,
  ClaimHistoryAction,
  ClaimStatusHistory,
  Policy,
  Vehicle,
} from "@/types/database";

export type CustomerVehicle = Pick<
  Vehicle,
  "make" | "model" | "year" | "plate_number" | "vin"
>;

export type CustomerPolicyAccess = "DIRECT" | "LINKED";

export type CustomerPolicy = Pick<
  Policy,
  | "id"
  | "policy_number"
  | "status"
  | "coverage_type"
  | "start_date"
  | "end_date"
  | "excess_amount"
  | "coverage_limit"
  | "purchase_request_id"
> & {
  annual_premium?: number | null;
  accessType: CustomerPolicyAccess;
  vehicles?: CustomerVehicle | CustomerVehicle[] | null;
};

export type CustomerClaim = Pick<
  Claim,
  "id" | "policy_id" | "claim_number" | "status" | "accident_date" | "created_at"
> & { vehicle: CustomerVehicle | null };

export type CustomerClaimDetail = CustomerClaim & Pick<
  Claim,
  "accident_location" | "description" | "updated_at"
> & {
  policyNumber: string;
  history: ClaimStatusHistory[];
  latestInformationRequest: string | null;
  rejectionReason: string | null;
};

function oneVehicle(
  value: CustomerVehicle | CustomerVehicle[] | null | undefined,
): CustomerVehicle | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getCustomerDashboard(userId: string): Promise<{
  policies: CustomerPolicy[];
  claims: CustomerClaim[];
  error: string | null;
}> {
  const supabase = createServiceRoleClient();
  const { data: links, error: linkError } = await supabase
    .from("customer_policy_links")
    .select("policy_id")
    .eq("portal_user_id", userId);

  if (linkError) {
    console.error("Customer policy links read failed:", linkError.message);
    return { policies: [], claims: [], error: "Unable to load your policies right now." };
  }

  const { data: directPolicies, error: directPolicyError } = await supabase
    .from("policies")
    .select(`*, vehicles (make, model, year, plate_number, vin)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (directPolicyError) {
    console.error("Customer policies read failed:", directPolicyError.message);
    return { policies: [], claims: [], error: "Unable to load your policies right now." };
  }

  const linkedPolicyIds = (links || []).map((link) => String(link.policy_id));
  let linkedPolicies: CustomerPolicy[] = [];
  if (linkedPolicyIds.length > 0) {
    const { data, error } = await supabase
      .from("policies")
      .select(`*, vehicles (make, model, year, plate_number, vin)`)
      .in("id", linkedPolicyIds)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Linked customer policies read failed:", error.message);
      return { policies: [], claims: [], error: "Unable to load your policies right now." };
    }
    linkedPolicies = (data || []).map((policy) => ({
      ...(policy as Omit<CustomerPolicy, "accessType">),
      accessType: "LINKED" as const,
    }));
  }

  const policyMap = new Map<string, CustomerPolicy>();
  for (const policy of directPolicies || []) {
    policyMap.set(policy.id, {
      ...(policy as Omit<CustomerPolicy, "accessType">),
      accessType: "DIRECT",
    });
  }
  for (const policy of linkedPolicies) {
    if (!policyMap.has(policy.id)) policyMap.set(policy.id, policy);
  }
  const accessiblePolicies = [...policyMap.values()];
  const policyIds = accessiblePolicies.map((policy) => policy.id);
  if (policyIds.length === 0) return { policies: [], claims: [], error: null };

  const { data: claims, error: claimError } = await supabase
    .from("claims")
    .select("id, policy_id, claim_number, status, accident_date, created_at")
    .in("policy_id", policyIds)
    .order("created_at", { ascending: false });

  if (claimError) {
    console.error("Customer claims read failed:", claimError.message);
    return { policies: accessiblePolicies, claims: [], error: "Unable to load your claims right now." };
  }

  return {
    policies: accessiblePolicies,
    claims: ((claims || []) as Omit<CustomerClaim, "vehicle">[]).map(
      (claim) => ({
        ...claim,
        vehicle: oneVehicle(
          accessiblePolicies.find((policy) => policy.id === claim.policy_id)?.vehicles,
        ),
      }),
    ),
    error: null,
  };
}

export async function getCustomerPolicyDetails(
  userId: string,
  policyId: string,
): Promise<{ policy: CustomerPolicy | null; error: string | null }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("policies")
    .select(`*, vehicles (make, model, year, plate_number, vin)`)
    .eq("id", policyId)
    .maybeSingle();

  if (error) {
    console.error("Customer policy detail read failed:", error.message);
    return { policy: null, error: "Unable to load this policy right now." };
  }
  if (!data) return { policy: null, error: null };

  if (data.user_id === userId) {
    return {
      policy: {
        ...(data as Omit<CustomerPolicy, "accessType">),
        accessType: "DIRECT",
      },
      error: null,
    };
  }

  const { data: link, error: linkError } = await supabase
    .from("customer_policy_links")
    .select("id")
    .eq("portal_user_id", userId)
    .eq("policy_id", policyId)
    .maybeSingle();

  if (linkError) {
    console.error("Customer policy detail authorization failed:", linkError.message);
    return { policy: null, error: "Unable to load this policy right now." };
  }
  if (!link) return { policy: null, error: null };

  return {
    policy: {
      ...(data as Omit<CustomerPolicy, "accessType">),
      accessType: "LINKED",
    },
    error: null,
  };
}

export async function getCustomerClaimDetails(
  userId: string,
  claimId: string,
): Promise<{ claim: CustomerClaimDetail | null; error: string | null }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, policy_id, claim_number, status, accident_date, accident_location, description, created_at, updated_at")
    .eq("id", claimId)
    .maybeSingle();
  if (error) {
    console.error("Customer claim detail read failed:", error.message);
    return { claim: null, error: "Unable to load this claim right now." };
  }
  if (!data) return { claim: null, error: null };

  const authorization = await getCustomerPolicyDetails(userId, data.policy_id);
  if (authorization.error) return { claim: null, error: authorization.error };
  if (!authorization.policy) return { claim: null, error: null };

  const { data: history, error: historyError } = await supabase
    .from("claim_status_history")
    .select("id, claim_id, from_status, to_status, action, note, actor_user_id, actor_role, created_at")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });
  if (historyError) {
    console.error("Customer claim history read failed:", historyError.message);
    return { claim: null, error: "Unable to load this claim's history right now." };
  }

  const vehicle = oneVehicle(authorization.policy.vehicles);
  const visibleHistory = ((history || []) as ClaimStatusHistory[])
    .filter((event) =>
      CUSTOMER_VISIBLE_HISTORY_ACTIONS.has(event.action as ClaimHistoryAction),
    )
    .map((event) => ({
      ...event,
      actor_user_id: null,
      note: ["MORE_INFO_REQUESTED", "CUSTOMER_INFO_SUBMITTED", "CLAIM_REJECTED"].includes(event.action)
        ? event.note
        : null,
    }));
  const latestRequest = [...visibleHistory].reverse().find((event) => event.action === "MORE_INFO_REQUESTED");
  const rejection = [...visibleHistory].reverse().find((event) => event.action === "CLAIM_REJECTED");

  return {
    claim: {
      ...data,
      vehicle,
      policyNumber: authorization.policy.policy_number,
      history: visibleHistory,
      latestInformationRequest: latestRequest?.note || null,
      rejectionReason: rejection?.note || null,
    } as CustomerClaimDetail,
    error: null,
  };
}
