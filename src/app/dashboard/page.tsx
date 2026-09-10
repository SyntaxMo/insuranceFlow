import Link from "next/link";
import { requireCustomer } from "@/lib/auth/session";
import { getCustomerDashboard } from "@/lib/claims/customer";
import { formatDate, statusTone } from "@/lib/format";
import { Alert, Card } from "@/components/ui/Forms";
import { ConfirmationToast } from "@/components/auth/ConfirmationToast";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export default async function CustomerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireCustomer();
  const { policies, claims, error } = await getCustomerDashboard(profile.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {params.confirmed === "1" ? <ConfirmationToast /> : null}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Customer dashboard</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">
            Welcome, {profile.full_name || "customer"}
          </h1>
          <p className="mt-2 text-slate-600">View your coverage and follow the progress of your claims.</p>
        </div>
        <Link href="/claim" className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-teal)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-teal-deep)]">
          Create a new claim
        </Link>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your policies</h2>
        {policies.length === 0 ? (
          <Card><p className="text-slate-600">No policies are linked to your account.</p></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {policies.map((policy) => {
              const vehicle = one(policy.vehicles);
              return (
                <Card key={policy.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-[var(--brand-navy)]">{policy.policy_number}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(policy.status)}`}>{policy.status}</span>
                  </div>
                  <p className="text-sm text-slate-700">{policy.coverage_type}</p>
                  <p className="text-sm text-slate-600">
                    {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year}) · ${vehicle.plate_number}` : "Vehicle details unavailable"}
                  </p>
                  <p className="text-xs text-slate-500">Coverage {formatDate(policy.start_date)} – {formatDate(policy.end_date)}</p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your claims</h2>
        {claims.length === 0 ? (
          <Card><p className="text-slate-600">You have not submitted any claims yet.</p></Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Claim number</th><th className="px-4 py-3">Accident date</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td className="px-4 py-3 font-semibold text-[var(--brand-navy)]">{claim.claim_number}</td>
                    <td className="px-4 py-3">{formatDate(claim.accident_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(claim.created_at)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}>{claim.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
