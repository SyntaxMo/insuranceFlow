import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

export const POLICY_LOOKUP_ERROR =
  "We couldn't verify a policy with those details. Check the information and try again.";

type RelatedPolicyholder = { email: string | null };
type RelatedVehicle = { make: string; model: string; year: number };

type PolicyLookupRow = {
  id: string;
  policy_number: string;
  status: string;
  start_date: string;
  end_date: string;
  coverage_type: string;
  policyholder: RelatedPolicyholder | RelatedPolicyholder[] | null;
  vehicle: RelatedVehicle | RelatedVehicle[] | null;
};

export type VerifiedPolicyMatch = {
  maskedPolicyNumber: string;
  vehicle: { make: string; model: string; year: number };
  coverageType: string;
  status: string;
  startDate: string;
  endDate: string;
  maskedEmail: string;
  isExpired: boolean;
};

export type ExistingPolicyResolution = {
  policyId: string;
  targetEmail: string;
  match: VerifiedPolicyMatch;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function normalizePolicyNumber(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function maskPolicyNumber(value: string): string {
  const compact = value.replace(/\s/g, "");
  return `••••${compact.slice(-4)}`;
}

export function maskEmail(value: string): string {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return "••••••••";
  if (localPart.length === 1) return `${localPart}••••@${domain}`;
  return `${localPart[0]}••••${localPart.at(-1)}@${domain}`;
}

export async function resolveExistingPolicyMatch(
  policyNumber: string,
  submittedEmail: string,
): Promise<ExistingPolicyResolution | null> {
  const normalizedPolicyNumber = normalizePolicyNumber(policyNumber);
  const normalizedSubmittedEmail = normalizeEmail(submittedEmail);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("policies")
    .select(
      `
        id,
        policy_number,
        status,
        start_date,
        end_date,
        coverage_type,
        policyholder:users (email),
        vehicle:vehicles (make, model, year)
      `,
    )
    .ilike("policy_number", normalizedPolicyNumber)
    .maybeSingle();

  if (error) {
    console.error("Existing policy lookup failed:", error.message);
    return null;
  }

  const policy = data as PolicyLookupRow | null;
  const policyholder = policy ? one(policy.policyholder) : null;
  const vehicle = policy ? one(policy.vehicle) : null;
  const registeredEmail = policyholder?.email
    ? normalizeEmail(policyholder.email)
    : null;

  if (
    !policy ||
    !policyholder ||
    !vehicle ||
    !registeredEmail ||
    registeredEmail !== normalizedSubmittedEmail
  ) {
    return null;
  }

  return {
    policyId: policy.id,
    targetEmail: registeredEmail,
    match: {
      maskedPolicyNumber: maskPolicyNumber(policy.policy_number),
      vehicle,
      coverageType: policy.coverage_type,
      status: policy.status,
      startDate: policy.start_date,
      endDate: policy.end_date,
      maskedEmail: maskEmail(registeredEmail),
      isExpired: policy.status.toUpperCase() === "EXPIRED",
    },
  };
}

export async function findExistingPolicyMatch(
  policyNumber: string,
  submittedEmail: string,
): Promise<VerifiedPolicyMatch | null> {
  const resolution = await resolveExistingPolicyMatch(
    policyNumber,
    submittedEmail,
  );
  return resolution?.match ?? null;
}
