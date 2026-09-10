import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card } from "@/components/ui/Forms";
import { getCustomerDashboard } from "@/lib/claims/customer";
import { formatCurrency, formatDate, statusLabel, statusTone } from "@/lib/format";
import { requireCustomer } from "@/lib/auth/session";

export default async function CustomerPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireCustomer()]);
  const { policies, error } = await getCustomerDashboard(profile.id);
  const policy = policies.find((item) => item.id === id);

  if (!policy && !error) notFound();
  if (!policy) {
    return <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><Alert tone="error">{error || "Unable to load this policy."}</Alert></main>;
  }

  const vehicle = Array.isArray(policy.vehicles) ? (policy.vehicles[0] ?? null) : (policy.vehicles ?? null);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-[var(--brand-teal)] hover:text-[var(--brand-teal-deep)]">← Back to dashboard</Link>
      <Card className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm text-slate-500">Policy {policy.policy_number}</p><h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">{vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : "Motor policy"}</h1></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(policy.status)}`}>{statusLabel(policy.status)}</span>
        </div>
        <dl className="mt-7 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Coverage type</dt><dd className="mt-1 font-medium text-slate-800">{policy.coverage_type}</dd></div>
          <div><dt className="text-xs text-slate-500">Vehicle plate</dt><dd className="mt-1 font-medium text-slate-800">{vehicle?.plate_number || "Not available"}</dd></div>
          <div><dt className="text-xs text-slate-500">Start date</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(policy.start_date)}</dd></div>
          <div><dt className="text-xs text-slate-500">End date</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(policy.end_date)}</dd></div>
          <div><dt className="text-xs text-slate-500">Excess</dt><dd className="mt-1 font-medium text-slate-800">{formatCurrency(policy.excess_amount)}</dd></div>
          <div><dt className="text-xs text-slate-500">Coverage limit</dt><dd className="mt-1 font-medium text-slate-800">{formatCurrency(policy.coverage_limit)}</dd></div>
        </dl>
        <div className="mt-7 flex justify-end"><Link href="/claim" className="inline-flex rounded-xl bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-teal-deep)]">Make a claim</Link></div>
      </Card>
    </main>
  );
}
