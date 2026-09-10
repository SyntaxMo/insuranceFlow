import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Claim, Policy, Vehicle } from "@/types/database";

export type CustomerVehicle = Pick<
  Vehicle,
  "make" | "model" | "year" | "plate_number"
>;

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
> & { vehicles?: Pick<Vehicle, "make" | "model" | "year" | "plate_number"> | Pick<Vehicle, "make" | "model" | "year" | "plate_number">[] | null };

export type CustomerClaim = Pick<
  Claim,
  "id" | "policy_id" | "claim_number" | "status" | "accident_date" | "created_at"
> & { vehicle: CustomerVehicle | null };

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
  const { data: policies, error: policyError } = await supabase
    .from("policies")
    .select(`id, policy_number, status, coverage_type, start_date, end_date,
      excess_amount, coverage_limit,
      vehicles (make, model, year, plate_number)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (policyError) {
    console.error("Customer policies read failed:", policyError.message);
    return { policies: [], claims: [], error: "Unable to load your policies right now." };
  }

  const ownedPolicies = (policies || []) as CustomerPolicy[];
  const policyIds = ownedPolicies.map((policy) => policy.id);
  if (policyIds.length === 0) return { policies: [], claims: [], error: null };

  const { data: claims, error: claimError } = await supabase
    .from("claims")
    .select("id, policy_id, claim_number, status, accident_date, created_at")
    .in("policy_id", policyIds)
    .order("created_at", { ascending: false });

  if (claimError) {
    console.error("Customer claims read failed:", claimError.message);
    return { policies: ownedPolicies, claims: [], error: "Unable to load your claims right now." };
  }

  return {
    policies: ownedPolicies,
    claims: ((claims || []) as Omit<CustomerClaim, "vehicle">[]).map(
      (claim) => ({
        ...claim,
        vehicle: oneVehicle(
          ownedPolicies.find((policy) => policy.id === claim.policy_id)?.vehicles,
        ),
      }),
    ),
    error: null,
  };
}
