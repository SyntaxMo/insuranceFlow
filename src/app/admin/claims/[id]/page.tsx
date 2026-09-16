import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadClaimAnalysis } from "@/lib/ai/analyze-claim";
import { getClaimById } from "@/lib/claims/admin";
import {
  formatCoverageType,
  formatCurrency,
  formatDate,
  formatDateTime,
  officerClaimStatusLabel,
  statusTone,
} from "@/lib/format";
import { documentTypeLabel } from "@/lib/validation/claim";
import { AiClaimAnalysis } from "@/components/admin/AiClaimAnalysis";
import { ClaimOfficerActions } from "@/components/admin/ClaimOfficerActions";
import { ClaimHistory } from "@/components/claims/ClaimHistory";
import { Alert, Card, buttonClassName } from "@/components/ui/Forms";

export const dynamic = "force-dynamic";

export default async function AdminClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { claim, error } = await getClaimById(id);
  if (!claim && !error) notFound();
  const savedAnalysis = claim
    ? await loadClaimAnalysis(claim.id)
    : { analysis: null, error: null, supabaseSql: undefined };

  if (error || !claim) {
    return <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><Link href="/admin/claims" className="text-sm font-semibold text-[var(--brand-teal)]">← Back to claims</Link><div className="mt-6"><Alert tone="error"><p className="font-semibold">Unable to open this claim</p><p className="mt-1">{error || "Claim not found."}</p></Alert></div></main>;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <Link href="/admin/claims" className="text-sm font-semibold text-[var(--brand-teal)] hover:underline">← Back to claims</Link>
      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-medium text-slate-500">Motor claim</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--brand-navy)] sm:text-4xl">{claim.claimNumber}</h1><p className="mt-2 text-sm text-slate-600">Submitted {formatDateTime(claim.createdAt)}</p></div>
        <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}>{officerClaimStatusLabel(claim.status)}</span>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)]">Claim summary</h2>
            <dl className="grid gap-4 sm:grid-cols-2"><Detail label="Accident date" value={formatDate(claim.accidentDate)} /><Detail label="Location" value={claim.accidentLocation} /><div className="sm:col-span-2"><Detail label="Description" value={claim.description} multiline /></div></dl>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="space-y-4"><h2 className="text-lg font-semibold text-[var(--brand-navy)]">Customer</h2><dl className="space-y-3"><Detail label="Full name" value={claim.customerName} /><Detail label="Email" value={claim.email || "Not provided"} /><Detail label="Phone" value={claim.phone || "Not provided"} /></dl></Card>
            <Card className="space-y-4"><h2 className="text-lg font-semibold text-[var(--brand-navy)]">Vehicle</h2><dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2"><Detail label="Make and model" value={`${claim.policy.vehicle.make} ${claim.policy.vehicle.model}`} /><Detail label="Year" value={String(claim.policy.vehicle.year)} /><Detail label="Bahrain plate" value={claim.policy.vehicle.plateNumber} /><Detail label="VIN" value={claim.policy.vehicle.vin || "Not provided"} /></dl></Card>
          </div>

          <Card className="space-y-4"><h2 className="text-lg font-semibold text-[var(--brand-navy)]">Policy</h2><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Policy number" value={claim.policy.policyNumber} /><Detail label="Coverage" value={formatCoverageType(claim.policy.coverageType)} /><Detail label="Policy status" value={claim.policyStatus} /><Detail label="Start date" value={formatDate(claim.policy.startDate)} /><Detail label="End date" value={formatDate(claim.policy.endDate)} /><Detail label="Excess" value={formatCurrency(claim.policy.excessAmount)} /><Detail label="Coverage limit" value={formatCurrency(claim.policy.coverageLimit)} /><Detail label="Annual premium" value={claim.annualPremium == null ? "Not available" : formatCurrency(claim.annualPremium)} /></dl></Card>

          <Card className="space-y-4"><div><h2 className="text-lg font-semibold text-[var(--brand-navy)]">Submitted evidence</h2><p className="mt-1 text-sm text-slate-600">Private documents are opened through a short-lived authorized link.</p></div>{claim.documents.length === 0 ? <p className="text-sm text-slate-600">No documents found.</p> : <div className="grid gap-3 sm:grid-cols-2">{claim.documents.map((document) => { const route = `/api/admin/claims/${claim.id}/documents/${document.id}`; const isImage = document.mimeType?.startsWith("image/"); return <article key={document.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">{isImage ? <div className="relative aspect-[16/10] bg-slate-100"><Image src={route} alt={`${documentTypeLabel(document.documentType)} evidence`} fill unoptimized className="object-cover" sizes="(max-width: 640px) 100vw, 420px" /></div> : null}<div className="p-3"><p className="text-sm font-semibold text-slate-900">{documentTypeLabel(document.documentType)}</p><p className="mt-1 break-all text-xs text-slate-500">{document.fileName}</p><div className="mt-3 flex gap-2"><a href={route} target="_blank" rel="noreferrer" className={buttonClassName("secondary", "min-h-9 px-3 py-2")}>Open securely</a><a href={`${route}?download=1`} className="self-center text-sm font-semibold text-[var(--brand-teal)] hover:underline">Download</a></div></div></article>; })}</div>}</Card>

          <AiClaimAnalysis claimId={claim.id} initialAnalysis={savedAnalysis.analysis} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <ClaimOfficerActions claimId={claim.id} status={claim.status} />
          <Card className="space-y-4"><h2 className="text-lg font-semibold text-[var(--brand-navy)]">Claim history</h2><ClaimHistory history={claim.history} showActor /></Card>
        </aside>
      </div>
    </main>
  );
}

function Detail({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className={`mt-1 font-medium text-slate-800 ${multiline ? "whitespace-pre-wrap text-sm leading-6" : ""}`}>{value}</dd></div>;
}
