import Link from "next/link";
import { BackToDashboardLink } from "@/components/navigation/BackToDashboardLink";
import { Alert, Card } from "@/components/ui/Forms";
import { ProfileIcon } from "@/components/ui/ProfileIcon";
import { requireCustomer } from "@/lib/auth/session";
import { getCustomerAccountSummary } from "@/lib/claims/customer";
import { formatDate } from "@/lib/format";

function ProfileAvatar() {
  return (
    <div
      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--brand-navy)] text-white shadow-sm ring-4 ring-teal-50"
      aria-hidden="true"
      data-testid="profile-page-avatar"
    >
      <ProfileIcon className="size-7" />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-4 first:pt-0 last:border-0 last:pb-0 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--brand-navy)] sm:mt-0">{value}</dd>
    </div>
  );
}

export default async function CustomerProfilePage() {
  const profile = await requireCustomer();
  const { summary, error } = await getCustomerAccountSummary(profile.id);
  const displayName = profile.full_name?.trim() || "Customer";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <BackToDashboardLink />
      <header className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <ProfileAvatar />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Account</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">Your profile</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Manage the contact information connected to your InsureFlow account.</p>
        </div>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="account-details-heading">
          <Card className="h-full">
            <h2 id="account-details-heading" className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Account details</h2>
            <p className="mt-1 text-sm text-slate-500">The identity connected to your customer portal.</p>
            <dl className="mt-6">
              <DetailRow label="Full name" value={displayName} />
              <DetailRow label="Member since" value={profile.created_at ? formatDate(profile.created_at) : "Not available"} />
            </dl>
          </Card>
        </section>

        <section aria-labelledby="contact-information-heading">
          <Card className="h-full">
            <h2 id="contact-information-heading" className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Contact information</h2>
            <p className="mt-1 text-sm text-slate-500">These details are view-only for now.</p>
            <dl className="mt-6">
              <DetailRow label="Email" value={profile.email?.trim() || "Not provided"} />
              <DetailRow label="Phone number" value={profile.phone?.trim() || "Not provided"} />
            </dl>
          </Card>
        </section>
      </div>

      <section className="mt-6" aria-labelledby="account-summary-heading">
        <Card>
          <div>
            <h2 id="account-summary-heading" className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Account activity</h2>
            <p className="mt-1 text-sm text-slate-500">A quick summary of policies and claims available to your account.</p>
          </div>
          {error || !summary ? (
            <div className="mt-5"><Alert tone="info">Account activity is temporarily unavailable. Your profile details are still shown above.</Alert></div>
          ) : (
            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Active policies", summary.activePolicies],
                ["Open claims", summary.openClaims],
                ["Total claims", summary.totalClaims],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-4">
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="mt-1 text-2xl font-semibold text-[var(--brand-navy)]">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="privacy-account-heading">
        <Card className="sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h2 id="privacy-account-heading" className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Privacy &amp; account</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">Review how this portfolio demonstration handles account information and simulated insurance activity.</p>
          </div>
          <nav aria-label="Account legal information" className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[var(--brand-teal-deep)] sm:mt-0 sm:justify-end">
            <Link href="/privacy" className="rounded underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Privacy</Link>
            <Link href="/terms" className="rounded underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Terms</Link>
            <Link href="/disclaimer" className="rounded underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Disclaimer</Link>
          </nav>
        </Card>
      </section>
    </main>
  );
}
