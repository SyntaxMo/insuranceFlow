import Link from "next/link";
import { listClaims } from "@/lib/claims/admin";
import { formatDate, formatDateTime, statusTone } from "@/lib/format";
import { Alert, Card } from "@/components/ui/Forms";

export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  const { claims, error } = await listClaims();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">
            Administration
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">
            Claims
          </h1>
          <p className="mt-2 text-slate-600">
            Review submitted motor claims and open a claim for full details.
          </p>
        </div>
        <Link
          href="/claim"
          className="text-sm font-semibold text-[var(--brand-teal)] hover:underline"
        >
          + New claim intake
        </Link>
      </div>

      {error ? (
        <Alert tone="error">
          <p className="font-semibold">Unable to load claims</p>
          <p className="mt-1">{error}</p>
        </Alert>
      ) : null}

      {!error && claims.length === 0 ? (
        <Card>
          <p className="text-slate-700">No claims have been submitted yet.</p>
        </Card>
      ) : null}

      {!error && claims.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Claim number</th>
                  <th className="px-4 py-3 font-semibold">Policy</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Accident date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-[var(--brand-navy)]">
                      <Link
                        href={`/admin/claims/${claim.id}`}
                        className="hover:underline"
                      >
                        {claim.claimNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{claim.policyNumber}</td>
                    <td className="px-4 py-3">{claim.vehicleLabel}</td>
                    <td className="px-4 py-3">
                      {formatDate(claim.accidentDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}
                      >
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(claim.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {claims.map((claim) => (
              <Link key={claim.id} href={`/admin/claims/${claim.id}`}>
                <Card className="space-y-2 transition hover:border-[var(--brand-teal)]/40">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-[var(--brand-navy)]">
                      {claim.claimNumber}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}
                    >
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{claim.vehicleLabel}</p>
                  <p className="text-sm text-slate-500">
                    Policy {claim.policyNumber} · Accident{" "}
                    {formatDate(claim.accidentDate)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
