import { listClaims } from "@/lib/claims/admin";
import { Alert } from "@/components/ui/Forms";
import { ClaimsQueue } from "@/components/admin/ClaimsQueue";

export const dynamic = "force-dynamic";

const METRICS = [
  ["SUBMITTED", "New"],
  ["UNDER_REVIEW", "Under Review"],
  ["MORE_INFO_REQUIRED", "Waiting on Customer"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
] as const;

export default async function AdminClaimsPage() {
  const { claims, error } = await listClaims();
  const counts = new Map<string, number>();
  for (const claim of claims) {
    const status = claim.status.toUpperCase();
    counts.set(status, (counts.get(status) || 0) + 1);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Claims Officer</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--brand-navy)] sm:text-4xl">Claims workspace</h1>
        <p className="mt-3 text-slate-600">Review submitted motor claims and manage customer follow-ups.</p>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Claim status summary">
        {METRICS.map(([status, label]) => (
          <div key={status} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-[var(--brand-navy)]">{counts.get(status) || 0}</p>
          </div>
        ))}
      </section>

      <div className="mt-10">
        {error ? <Alert tone="error"><p className="font-semibold">Unable to load claims</p><p className="mt-1">{error}</p></Alert> : <ClaimsQueue claims={claims} />}
      </div>
    </div>
  );
}
