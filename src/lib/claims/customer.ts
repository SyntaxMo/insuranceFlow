import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { CUSTOMER_VISIBLE_HISTORY_ACTIONS } from "@/lib/claims/workflow";
import { evaluatePolicyEligibility } from "@/lib/claims/policy-eligibility";
import type {
  Claim,
  ClaimPolicyOption,
  ClaimHistoryView,
  ClaimHistoryAction,
  Policy,
  Vehicle,
} from "@/types/database";

export type CustomerVehicle = Pick<
  Vehicle,
  "id" | "make" | "model" | "year" | "plate_number" | "vin"
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
  history: ClaimHistoryView[];
  latestInformationRequest: string | null;
  rejectionReason: string | null;
};

export type CustomerAccountSummary = {
  activePolicies: number;
  openClaims: number;
  totalClaims: number;
};

export function summarizeCustomerAccount(
  policies: CustomerPolicy[],
  claims: CustomerClaim[],
): CustomerAccountSummary {
  const uniquePolicies = [...new Map(policies.map((policy) => [policy.id, policy])).values()];
  const uniqueClaims = [...new Map(claims.map((claim) => [claim.id, claim])).values()];
  return {
    activePolicies: uniquePolicies.filter(
      (policy) => policy.status.toUpperCase() === "ACTIVE",
    ).length,
    openClaims: uniqueClaims.filter(
      (claim) => !["REJECTED", "CLOSED"].includes(claim.status.toUpperCase()),
    ).length,
    totalClaims: uniqueClaims.length,
  };
}

function oneVehicle(
  value: CustomerVehicle | CustomerVehicle[] | null | undefined,
): CustomerVehicle | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const CUSTOMER_POLICY_COLUMNS = `
  id, policy_number, status, coverage_type, start_date, end_date,
  excess_amount, coverage_limit, annual_premium, purchase_request_id,
  vehicles (id, make, model, year, plate_number, vin)
`;

type CustomerPolicyRow = Omit<CustomerPolicy, "accessType"> & {
  user_id?: string;
};

function customerPolicyDto(
  row: CustomerPolicyRow,
  accessType: CustomerPolicyAccess,
): CustomerPolicy {
  const vehicles = row.vehicles
    ? (Array.isArray(row.vehicles) ? row.vehicles : [row.vehicles]).map((vehicle) => ({
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plate_number: vehicle.plate_number,
        vin: vehicle.vin ?? null,
      }))
    : null;
  return {
    id: row.id,
    policy_number: row.policy_number,
    status: row.status,
    coverage_type: row.coverage_type,
    start_date: row.start_date,
    end_date: row.end_date,
    excess_amount: row.excess_amount,
    coverage_limit: row.coverage_limit,
    purchase_request_id: row.purchase_request_id ?? null,
    annual_premium: row.annual_premium ?? null,
    accessType,
    vehicles,
  };
}

export async function getAccessibleCustomerPolicies(userId: string): Promise<{
  policies: CustomerPolicy[];
  error: string | null;
}> {
  const supabase = createServiceRoleClient();
  const { data: links, error: linkError } = await supabase
    .from("customer_policy_links")
    .select("policy_id")
    .eq("portal_user_id", userId);

  if (linkError) {
    console.error("Customer policy links read failed:", { code: linkError.code || "DATABASE_ERROR" });
    return { policies: [], error: "Unable to load your policies right now." };
  }

  const { data: directPolicies, error: directPolicyError } = await supabase
    .from("policies")
    .select(CUSTOMER_POLICY_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (directPolicyError) {
    console.error("Customer policies read failed:", { code: directPolicyError.code || "DATABASE_ERROR" });
    return { policies: [], error: "Unable to load your policies right now." };
  }

  const linkedPolicyIds = (links || []).map((link) => String(link.policy_id));
  let linkedPolicies: CustomerPolicy[] = [];
  if (linkedPolicyIds.length > 0) {
    const { data, error } = await supabase
      .from("policies")
      .select(CUSTOMER_POLICY_COLUMNS)
      .in("id", linkedPolicyIds)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Linked customer policies read failed:", { code: error.code || "DATABASE_ERROR" });
      return { policies: [], error: "Unable to load your policies right now." };
    }
    linkedPolicies = (data || []).map((policy) =>
      customerPolicyDto(policy as CustomerPolicyRow, "LINKED"),
    );
  }

  const policyMap = new Map<string, CustomerPolicy>();
  for (const policy of directPolicies || []) {
    const dto = customerPolicyDto(policy as CustomerPolicyRow, "DIRECT");
    policyMap.set(dto.id, dto);
  }
  for (const policy of linkedPolicies) {
    if (!policyMap.has(policy.id)) policyMap.set(policy.id, policy);
  }

  return { policies: [...policyMap.values()], error: null };
}

export async function getEligibleCustomerClaimPolicies(
  userId: string,
): Promise<{ policies: ClaimPolicyOption[]; error: string | null }> {
  const accessible = await getAccessibleCustomerPolicies(userId);
  if (accessible.error) return { policies: [], error: accessible.error };

  const policies: ClaimPolicyOption[] = [];
  for (const policy of accessible.policies) {
    const eligibility = evaluatePolicyEligibility(policy);
    if (!eligibility.ok) continue;
    policies.push({
      ...eligibility.policy,
      status: policy.status,
      accessType: policy.accessType,
    });
  }

  return { policies, error: null };
}

export async function getCustomerDashboard(userId: string): Promise<{
  policies: CustomerPolicy[];
  claims: CustomerClaim[];
  error: string | null;
}> {
  const accessible = await getAccessibleCustomerPolicies(userId);
  if (accessible.error) {
    return { policies: [], claims: [], error: accessible.error };
  }
  const accessiblePolicies = accessible.policies;
  const policyIds = accessiblePolicies.map((policy) => policy.id);
  if (policyIds.length === 0) return { policies: [], claims: [], error: null };

  const supabase = createServiceRoleClient();
  const { data: claims, error: claimError } = await supabase
    .from("claims")
    .select("id, policy_id, claim_number, status, accident_date, created_at")
    .in("policy_id", policyIds)
    .order("created_at", { ascending: false });

  if (claimError) {
    console.error("Customer claims read failed:", { code: claimError.code || "DATABASE_ERROR" });
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

export async function getCustomerAccountSummary(userId: string): Promise<{
  summary: CustomerAccountSummary | null;
  error: string | null;
}> {
  const dashboard = await getCustomerDashboard(userId);
  if (dashboard.error) return { summary: null, error: dashboard.error };
  return {
    summary: summarizeCustomerAccount(dashboard.policies, dashboard.claims),
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
    .select(`user_id, ${CUSTOMER_POLICY_COLUMNS}`)
    .eq("id", policyId)
    .maybeSingle();

  if (error) {
    console.error("Customer policy detail read failed:", { code: error.code || "DATABASE_ERROR" });
    return { policy: null, error: "Unable to load this policy right now." };
  }
  if (!data) return { policy: null, error: null };

  if (data.user_id === userId) {
    return {
      policy: {
        ...customerPolicyDto(data as CustomerPolicyRow, "DIRECT"),
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
    console.error("Customer policy detail authorization failed:", { code: linkError.code || "DATABASE_ERROR" });
    return { policy: null, error: "Unable to load this policy right now." };
  }
  if (!link) return { policy: null, error: null };

  return {
    policy: {
      ...customerPolicyDto(data as CustomerPolicyRow, "LINKED"),
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
    console.error("Customer claim detail read failed:", { code: error.code || "DATABASE_ERROR" });
    return { claim: null, error: "Unable to load this claim right now." };
  }
  if (!data) return { claim: null, error: null };

  const authorization = await getCustomerPolicyDetails(userId, data.policy_id);
  if (authorization.error) return { claim: null, error: authorization.error };
  if (!authorization.policy) return { claim: null, error: null };

  const { data: history, error: historyError } = await supabase
    .from("claim_status_history")
    .select("id, action, note, created_at")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });
  if (historyError) {
    console.error("Customer claim history read failed:", { code: historyError.code || "DATABASE_ERROR" });
    return { claim: null, error: "Unable to load this claim's history right now." };
  }

  const vehicle = oneVehicle(authorization.policy.vehicles);
  const visibleHistory = ((history || []) as ClaimHistoryView[])
    .filter((event) =>
      CUSTOMER_VISIBLE_HISTORY_ACTIONS.has(event.action as ClaimHistoryAction),
    )
    .map((event) => ({
      id: event.id,
      action: event.action,
      created_at: event.created_at,
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
