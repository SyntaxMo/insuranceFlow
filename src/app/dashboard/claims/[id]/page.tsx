import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card } from "@/components/ui/Forms";
import { CustomerClaimResponse } from "@/components/dashboard/CustomerClaimResponse";
import { CustomerClaimSubmissionSuccess } from "@/components/dashboard/CustomerClaimSubmissionSuccess";
import { ClaimHistory } from "@/components/claims/ClaimHistory";
import { getCustomerClaimDetails } from "@/lib/claims/customer";
import { formatDate, statusLabel, statusTone } from "@/lib/format";
import { requireCustomer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CustomerClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ id }, query, profile] = await Promise.all([params, searchParams, requireCustomer()]);
  const { claim, error } = await getCustomerClaimDetails(profile.id, id);
  if (!claim && !error) notFound();
  if (!claim) return <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><Alert tone="error">{error || "Unable to load this claim."}</Alert></main>;

  const normalizedStatus = claim.status.toUpperCase();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-[var(--brand-teal)] hover:text-[var(--brand-teal-deep)]">← Back to dashboard</Link>
      {query.submitted === "1" ? <CustomerClaimSubmissionSuccess /> : null}
      <Card className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-500">Motor claim</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--brand-navy)]">{claim.claim_number}</h1></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}>{statusLabel(claim.status)}</span></div>

        {normalizedStatus === "APPROVED" ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-900">Claim approved</p><p className="mt-1 text-sm text-emerald-800">A Claims Officer approved this claim in the InsureFlow demonstration workflow. This does not represent a real settlement or payment.</p></div> : null}
        {normalizedStatus === "REJECTED" || (normalizedStatus === "CLOSED" && claim.rejectionReason) ? <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="font-semibold text-rose-900">Claim rejected</p><p className="mt-2 whitespace-pre-wrap text-sm text-rose-800">{claim.rejectionReason || "The claims team has completed its review."}</p></div> : null}
        {normalizedStatus === "CLOSED" && !claim.rejectionReason ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">Claim closed</p><p className="mt-1 text-sm text-slate-700">This demonstration claim is complete and read-only.</p></div> : null}

        <dl className="mt-7 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <Detail label="Policy number" value={claim.policyNumber} />
          <Detail label="Related vehicle" value={claim.vehicle ? `${claim.vehicle.make} ${claim.vehicle.model} (${claim.vehicle.year})` : "Not available"} />
          <Detail label="Plate number" value={claim.vehicle?.plate_number || "Not available"} />
          <Detail label="Accident date" value={formatDate(claim.accident_date)} />
          <Detail label="Accident location" value={claim.accident_location} />
          <Detail label="Date submitted" value={formatDate(claim.created_at)} />
          <div className="sm:col-span-2"><Detail label="Description" value={claim.description} /></div>
        </dl>

        {normalizedStatus === "MORE_INFO_REQUIRED" ? <CustomerClaimResponse claimId={claim.id} requestMessage={claim.latestInformationRequest || "Please provide the additional information requested by the claims team."} /> : null}
      </Card>

      <Card className="mt-6 space-y-4"><h2 className="text-lg font-semibold text-[var(--brand-navy)]">Claim history</h2><ClaimHistory history={claim.history} /></Card>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{value}</dd></div>;
}
