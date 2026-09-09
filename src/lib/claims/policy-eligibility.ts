import type { Policy, Vehicle, VerifiedPolicySummary } from "@/types/database";

export type PolicyVerificationResult =
  | { ok: true; policy: VerifiedPolicySummary }
  | {
      ok: false;
      error: string;
      code: "NOT_FOUND" | "INACTIVE" | "EXPIRED" | "INVALID" | "SERVER";
    };

function asSingleVehicle(
  vehicles: Vehicle | Vehicle[] | null | undefined,
): Vehicle | null {
  if (!vehicles) return null;
  return Array.isArray(vehicles) ? (vehicles[0] ?? null) : vehicles;
}

function toDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function mapPolicyToSummary(policy: Policy): VerifiedPolicySummary | null {
  const vehicle = asSingleVehicle(policy.vehicles);
  if (!vehicle) return null;

  return {
    policyId: policy.id,
    policyNumber: policy.policy_number,
    coverageType: policy.coverage_type,
    excessAmount: Number(policy.excess_amount),
    coverageLimit: Number(policy.coverage_limit),
    startDate: policy.start_date,
    endDate: policy.end_date,
    vehicle: {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      plateNumber: vehicle.plate_number,
    },
  };
}

export function evaluatePolicyEligibility(
  policy: Policy,
): PolicyVerificationResult {
  const summary = mapPolicyToSummary(policy);
  if (!summary) {
    return {
      ok: false,
      code: "INVALID",
      error: "This policy is missing vehicle information.",
    };
  }

  const status = String(policy.status || "").toUpperCase();
  if (status !== "ACTIVE") {
    return {
      ok: false,
      code: "INACTIVE",
      error: "This policy is not active and cannot be used for a new claim.",
    };
  }

  const today = startOfToday();
  const start = toDateOnly(policy.start_date);
  const end = toDateOnly(policy.end_date);

  if (today < start) {
    return {
      ok: false,
      code: "INVALID",
      error: "This policy coverage has not started yet.",
    };
  }

  if (today > end) {
    return {
      ok: false,
      code: "EXPIRED",
      error: "This policy has expired and cannot be used for a new claim.",
    };
  }

  return { ok: true, policy: summary };
}
