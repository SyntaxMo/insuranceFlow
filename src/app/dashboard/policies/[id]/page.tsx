import Link from "next/link";
import { notFound } from "next/navigation";
import { PolicyAccessControl } from "@/components/dashboard/PolicyAccessControl";
import { Alert, buttonClassName, Card } from "@/components/ui/Forms";
import { getCustomerPolicyDetails } from "@/lib/claims/customer";
import { formatCoverageType, formatCurrency, formatDate, statusLabel, statusTone } from "@/lib/format";
import { requireCustomer } from "@/lib/auth/session";
import { getPolicyDocumentMetadata } from "@/lib/policies/policy-document-delivery";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1.5 font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export default async function CustomerPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, profile] = await Promise.all([params, requireCustomer()]);
  const { policy, error } = await getCustomerPolicyDetails(profile.id, id);

  if (!policy && !error) notFound();
  if (!policy) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Alert tone="error">{error || "Unable to load this policy."}</Alert>
      </main>
    );
  }

  const vehicle = Array.isArray(policy.vehicles)
    ? (policy.vehicles[0] ?? null)
    : (policy.vehicles ?? null);
  const policyDocument = await getPolicyDocumentMetadata(policy.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/dashboard"
        className={buttonClassName("secondary")}
      >
        ← Back to dashboard
      </Link>

      <header className="mt-5 rounded-3xl bg-[var(--brand-navy)] px-5 py-7 text-white shadow-[0_24px_60px_-38px_rgba(15,23,42,0.75)] sm:px-8 sm:py-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-teal-200">Policy {policy.policy_number}</p>
            <h1 className="mt-2 max-w-3xl font-[family-name:var(--font-display)] text-3xl leading-tight sm:text-4xl">
              {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : "Motor policy"}
            </h1>
            <p className="mt-2 text-sm text-slate-300">{formatCoverageType(policy.coverage_type)} motor insurance</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(policy.status)}`}>
              {statusLabel(policy.status)}
            </span>
            {policy.accessType === "LINKED" ? (
              <PolicyAccessControl policyId={policy.id} inverse />
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="policy-information-heading">
          <Card className="h-full">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Policy record</p>
            <h2 id="policy-information-heading" className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Policy information</h2>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <Detail label="Policy number">{policy.policy_number}</Detail>
              <Detail label="Coverage">{formatCoverageType(policy.coverage_type)}</Detail>
              <Detail label="Status">{statusLabel(policy.status)}</Detail>
              <Detail label="Policy period">{formatDate(policy.start_date)} – {formatDate(policy.end_date)}</Detail>
            </dl>
          </Card>
        </section>

        <section aria-labelledby="vehicle-information-heading">
          <Card className="h-full">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Insured vehicle</p>
            <h2 id="vehicle-information-heading" className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Vehicle information</h2>
            {vehicle ? (
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <Detail label="Make">{vehicle.make}</Detail>
                <Detail label="Model">{vehicle.model}</Detail>
                <Detail label="Year">{vehicle.year}</Detail>
                <Detail label="Plate number">{vehicle.plate_number}</Detail>
                {vehicle.vin ? <Detail label="VIN">{vehicle.vin}</Detail> : null}
              </dl>
            ) : (
              <p className="mt-6 text-sm text-slate-600">Vehicle information is not available for this policy.</p>
            )}
          </Card>
        </section>
      </div>

      <section className="mt-6" aria-labelledby="coverage-financials-heading">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Policy limits</p>
          <h2 id="coverage-financials-heading" className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Coverage & financials</h2>
          <dl className={`mt-6 grid gap-5 sm:items-start ${policy.annual_premium == null ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
            <Detail label="Coverage type">{formatCoverageType(policy.coverage_type)}</Detail>
            <Detail label="Excess">{formatCurrency(policy.excess_amount)}</Detail>
            <Detail label="Coverage limit">{formatCurrency(policy.coverage_limit)}</Detail>
            {policy.annual_premium != null ? <Detail label="Annual premium">{formatCurrency(policy.annual_premium)}</Detail> : null}
          </dl>
        </Card>
      </section>

      <section className="mt-6 rounded-2xl bg-teal-50 px-5 py-6 ring-1 ring-inset ring-teal-100 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Need to make a claim?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">If you&apos;ve been involved in an accident, you can start a motor claim using this policy.</p>
        </div>
        <div className="mt-5 flex w-full flex-col gap-3 sm:mt-0 sm:w-auto sm:flex-row">
          {policyDocument ? (
            <a
              href={`/dashboard/policies/${policy.id}/document`}
              className={buttonClassName("secondary", "w-full shrink-0 sm:w-auto")}
              aria-label={`Download policy ${policy.policy_number}`}
            >
              Download policy
            </a>
          ) : null}
          <Link href="/claim" className={buttonClassName("primary", "w-full shrink-0 sm:w-auto")}>
            Make a claim
          </Link>
        </div>
      </section>

      <p className="mt-8 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-500">
        This page provides a summary of your policy information. Coverage is subject to the full policy terms and conditions.
      </p>
    </main>
  );
}
