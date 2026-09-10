import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card } from "@/components/ui/Forms";
import { getCustomerDashboard } from "@/lib/claims/customer";
import { formatDate, statusLabel, statusTone } from "@/lib/format";
import { requireCustomer } from "@/lib/auth/session";

export default async function CustomerClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireCustomer()]);
  const { claims, error } = await getCustomerDashboard(profile.id);
  const claim = claims.find((item) => item.id === id);

  if (!claim && !error) notFound();
  if (!claim) {
    return <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><Alert tone="error">{error || "Unable to load this claim."}</Alert></main>;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-[var(--brand-teal)] hover:text-[var(--brand-teal-deep)]">← Back to dashboard</Link>
      <Card className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm text-slate-500">Motor claim</p><h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">{claim.claim_number}</h1></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}>{statusLabel(claim.status)}</span>
        </div>
        {claim.status.toUpperCase() === "MORE_INFO_REQUIRED" ? <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">The claims team needs additional information. The response workflow will be available soon.</div> : null}
        <dl className="mt-7 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Related vehicle</dt><dd className="mt-1 font-medium text-slate-800">{claim.vehicle ? `${claim.vehicle.make} ${claim.vehicle.model} (${claim.vehicle.year})` : "Not available"}</dd></div>
          <div><dt className="text-xs text-slate-500">Plate number</dt><dd className="mt-1 font-medium text-slate-800">{claim.vehicle?.plate_number || "Not available"}</dd></div>
          <div><dt className="text-xs text-slate-500">Accident date</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(claim.accident_date)}</dd></div>
          <div><dt className="text-xs text-slate-500">Date submitted</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(claim.created_at)}</dd></div>
        </dl>
      </Card>
    </main>
  );
}
