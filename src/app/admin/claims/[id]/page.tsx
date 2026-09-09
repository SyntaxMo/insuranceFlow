import Link from "next/link";
import { notFound } from "next/navigation";
import { loadClaimAnalysis } from "@/lib/ai/analyze-claim";
import { getClaimById } from "@/lib/claims/admin";
import { formatCurrency, formatDate, formatDateTime, statusTone } from "@/lib/format";
import { documentTypeLabel } from "@/lib/validation/claim";
import { AiClaimAnalysis } from "@/components/admin/AiClaimAnalysis";
import { Alert, Card } from "@/components/ui/Forms";

export const dynamic = "force-dynamic";

export default async function AdminClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { claim, error } = await getClaimById(id);
  const savedAnalysis = claim
    ? await loadClaimAnalysis(claim.id)
    : { analysis: null, error: null, supabaseSql: undefined };

  if (!claim && !error) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/admin/claims"
        className="text-sm font-semibold text-[var(--brand-teal)] hover:underline"
      >
        ← Back to claims
      </Link>

      {error || !claim ? (
        <div className="mt-6">
          <Alert tone="error">
            <p className="font-semibold">Unable to open this claim</p>
            <p className="mt-1">{error || "Claim not found."}</p>
          </Alert>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">
                {claim.claimNumber}
              </h1>
              <p className="mt-1 text-slate-600">
                Submitted {formatDateTime(claim.createdAt)}
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}
            >
              {claim.status}
            </span>
          </div>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Accident details
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Accident date</dt>
                <dd className="font-medium">{formatDate(claim.accidentDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Location</dt>
                <dd className="font-medium">{claim.accidentLocation}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Description</dt>
                <dd className="font-medium whitespace-pre-wrap">
                  {claim.description}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Policy & vehicle
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Policy number</dt>
                <dd className="font-medium">{claim.policy.policyNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Coverage type</dt>
                <dd className="font-medium">{claim.policy.coverageType}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Vehicle</dt>
                <dd className="font-medium">
                  {claim.policy.vehicle.make} {claim.policy.vehicle.model} (
                  {claim.policy.vehicle.year})
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Plate number</dt>
                <dd className="font-medium">
                  {claim.policy.vehicle.plateNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Excess</dt>
                <dd className="font-medium">
                  {formatCurrency(claim.policy.excessAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Coverage limit</dt>
                <dd className="font-medium">
                  {formatCurrency(claim.policy.coverageLimit)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Contact information
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="font-medium">{claim.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="font-medium">{claim.phone}</dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Submitted documents
            </h2>
            {claim.documents.length === 0 ? (
              <p className="text-sm text-slate-600">No documents found.</p>
            ) : (
              <ul className="space-y-2">
                {claim.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-1 rounded-xl border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {documentTypeLabel(doc.documentType)}
                      </p>
                      <p className="text-xs text-slate-500">{doc.fileName}</p>
                    </div>
                    {doc.signedUrl ? (
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-[var(--brand-teal)] hover:underline"
                      >
                        Open file
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">
                        File unavailable
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <AiClaimAnalysis
            claimId={claim.id}
            initialAnalysis={savedAnalysis.analysis}
            initialError={savedAnalysis.error}
            setupSql={savedAnalysis.supabaseSql ?? null}
          />
        </div>
      )}
    </div>
  );
}
