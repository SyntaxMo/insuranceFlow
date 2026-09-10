import Link from "next/link";
import { ConfirmationToast } from "@/components/auth/ConfirmationToast";
import { Alert, Card } from "@/components/ui/Forms";
import { getCustomerDashboard } from "@/lib/claims/customer";
import { formatCurrency, formatDate, statusLabel, statusTone } from "@/lib/format";
import { requireCustomer } from "@/lib/auth/session";

const primaryAction =
  "inline-flex items-center justify-center rounded-xl bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]";
const secondaryAction =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function vehicleName(vehicle: { make: string; model: string; year: number; plate_number: string } | null) {
  return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : "Vehicle details unavailable";
}

function EmptyState({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-start gap-5 border-dashed bg-slate-50/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex max-w-2xl gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[var(--brand-teal)] ring-1 ring-teal-100">
          <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
            <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{children}</div>
    </Card>
  );
}

export default async function CustomerDashboardPage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const params = await searchParams;
  const profile = await requireCustomer();
  const { policies, claims, error } = await getCustomerDashboard(profile.id);
  const actionRequired = claims.filter((claim) => claim.status.toUpperCase() === "MORE_INFO_REQUIRED");
  const activePolicies = policies.filter((policy) => policy.status.toUpperCase() === "ACTIVE").length;
  const openClaims = claims.filter((claim) => !["APPROVED", "REJECTED", "CLOSED"].includes(claim.status.toUpperCase())).length;
  const activities = [
    ...claims.map((claim) => ({
      id: `claim-${claim.id}`,
      date: claim.created_at,
      title: `Claim ${claim.claim_number} submitted`,
      detail: vehicleName(claim.vehicle),
    })),
    ...policies.map((policy) => ({
      id: `policy-${policy.id}`,
      date: policy.start_date,
      title: `Policy ${policy.policy_number} coverage started`,
      detail: policy.coverage_type,
    })),
  ]
    .filter((activity) => !Number.isNaN(new Date(activity.date).getTime()))
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {params.confirmed === "1" ? <ConfirmationToast /> : null}

      <header className="rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.45)] sm:px-7 sm:py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Customer dashboard</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">Welcome, {profile.full_name || "customer"}</h1>
            <p className="mt-2 max-w-2xl text-slate-600">View your motor policies, track claims, and see when the claims team needs you.</p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <span><strong className="text-[var(--brand-navy)]">{activePolicies}</strong> active {activePolicies === 1 ? "policy" : "policies"}</span>
              <span><strong className="text-[var(--brand-navy)]">{openClaims}</strong> open {openClaims === 1 ? "claim" : "claims"}</span>
            </div>
          </div>
          <Link href="/claim" className={`${primaryAction} w-full sm:w-auto`}>Create a new claim</Link>
        </div>
      </header>

      {error ? <div className="mt-6"><Alert tone="error">{error}</Alert></div> : null}

      {actionRequired.length > 0 ? (
        <section className="mt-8" aria-labelledby="action-required-heading">
          <div className="mb-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-orange-500" aria-hidden="true" />
            <h2 id="action-required-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Action required</h2>
          </div>
          <div className="grid gap-3">
            {actionRequired.map((claim) => (
              <div key={claim.id} className="flex flex-col gap-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3"><p className="font-semibold text-[var(--brand-navy)]">{claim.claim_number}</p><StatusBadge status={claim.status} /></div>
                  <p className="mt-2 text-sm text-slate-700">The claims team needs additional information to continue reviewing this claim.</p>
                </div>
                <Link href={`/dashboard/claims/${claim.id}`} className={`${secondaryAction} shrink-0`}>View request</Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="policies-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Coverage</p><h2 id="policies-heading" className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Your policies</h2></div>
          {policies.length > 0 ? <Link href="/dashboard/policies/link" className="text-sm font-semibold text-[var(--brand-teal)] hover:text-[var(--brand-teal-deep)]">Link a policy</Link> : null}
        </div>

        {policies.length === 0 ? (
          <EmptyState title="No policies linked yet" description="Link an existing policy or get motor insurance to start managing your coverage online.">
            <Link href="/dashboard/policies/link" className={`${secondaryAction} flex-1 sm:flex-none`}>Link existing policy</Link>
            <Link href="/dashboard/policies/new" className={`${primaryAction} flex-1 sm:flex-none`}>Get a policy</Link>
          </EmptyState>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {policies.map((policy) => {
              const vehicle = Array.isArray(policy.vehicles) ? (policy.vehicles[0] ?? null) : (policy.vehicles ?? null);
              return (
                <Card key={policy.id} className="flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Policy {policy.policy_number}</p><h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">{vehicleName(vehicle)}</h3>{vehicle ? <p className="mt-1 text-xs text-slate-500">Plate {vehicle.plate_number}</p> : null}</div>
                    <StatusBadge status={policy.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-y border-slate-100 py-4 text-sm">
                    <div><dt className="text-xs text-slate-500">Coverage</dt><dd className="mt-1 font-medium text-slate-800">{policy.coverage_type}</dd></div>
                    <div><dt className="text-xs text-slate-500">Policy period</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(policy.start_date)} – {formatDate(policy.end_date)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Excess</dt><dd className="mt-1 font-medium text-slate-800">{formatCurrency(policy.excess_amount)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Coverage limit</dt><dd className="mt-1 font-medium text-slate-800">{formatCurrency(policy.coverage_limit)}</dd></div>
                  </dl>
                  <div className="mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Link href={`/dashboard/policies/${policy.id}`} className={secondaryAction}>View policy</Link>
                    <Link href="/claim" className={primaryAction}>Make a claim</Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="claims-heading">
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Claims</p><h2 id="claims-heading" className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Your claims</h2></div>
        {claims.length === 0 ? (
          <EmptyState title="No claims yet" description="If you've been involved in an accident, you can start a new motor claim here.">
            <Link href="/claim" className={`${primaryAction} w-full sm:w-auto`}>Create a new claim</Link>
          </EmptyState>
        ) : (
          <div className="grid gap-4">
            {claims.map((claim) => (
              <Card key={claim.id} className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3"><h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">{claim.claim_number}</h3><StatusBadge status={claim.status} /></div>
                  <p className="mt-1 text-sm font-medium text-slate-700">{vehicleName(claim.vehicle)}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500"><span>Accident {formatDate(claim.accident_date)}</span><span>Submitted {formatDate(claim.created_at)}</span><span>Latest update: {statusLabel(claim.status)}</span></div>
                </div>
                <Link href={`/dashboard/claims/${claim.id}`} className={`${secondaryAction} shrink-0`}>View claim</Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="activity-heading">
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Timeline</p><h2 id="activity-heading" className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Recent activity</h2></div>
        <Card>
          {activities.length === 0 ? (
            <div className="py-4 text-center"><p className="font-medium text-[var(--brand-navy)]">No recent activity</p><p className="mt-1 text-sm text-slate-500">Policy and claim updates will appear here.</p></div>
          ) : (
            <ol className="divide-y divide-slate-100">
              {activities.map((activity) => (
                <li key={activity.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--brand-teal)] ring-4 ring-teal-50" aria-hidden="true" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800">{activity.title}</p><p className="mt-0.5 truncate text-xs text-slate-500">{activity.detail}</p></div>
                  <time className="shrink-0 text-xs text-slate-500" dateTime={activity.date}>{formatDate(activity.date)}</time>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </section>
    </main>
  );
}
