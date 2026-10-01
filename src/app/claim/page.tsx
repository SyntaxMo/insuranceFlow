import type { Metadata } from "next";
import { ClaimWizard } from "@/components/claim/ClaimWizard";
import { BackToDashboardLink } from "@/components/navigation/BackToDashboardLink";
import { requireCustomer } from "@/lib/auth/session";
import { getEligibleCustomerClaimPolicies } from "@/lib/claims/customer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Start a motor claim | InsureFlow" };

export default async function ClaimPage({
  searchParams,
}: {
  searchParams?: Promise<{ policy?: string | string[]; from?: string | string[] }>;
} = {}) {
  const profile = await requireCustomer();
  const { policies, error } = await getEligibleCustomerClaimPolicies(profile.id);
  const query = await searchParams;
  // Only the authenticated customer's eligible policy list can authorize entry.
  // Unknown IDs and repeated query parameters fall back to generic intake.
  const initialPolicy = !error && typeof query?.policy === "string"
    ? policies.find((policy) => policy.policyId === query.policy)
    : undefined;
  const returnToPolicy = initialPolicy && query?.from === "policy";
  const backHref = returnToPolicy
    ? `/dashboard/policies/${initialPolicy.policyId}`
    : "/dashboard";
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <BackToDashboardLink href={backHref} label={returnToPolicy ? "Back to policy" : "Back to dashboard"} />
      <div className="mb-8 mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">
          Claim intake
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">
          Start your motor claim
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Complete each step to choose your policy, describe the accident,
          attach documents, and submit for review.
        </p>
      </div>
      <ClaimWizard
        key={`${initialPolicy?.policyId ?? "generic"}:${backHref}`}
        initialPolicyId={initialPolicy?.policyId}
        initialEmail={profile.email || ""}
        initialPhone={profile.phone || ""}
        policies={policies}
        policyLoadError={error}
      />
    </div>
  );
}
