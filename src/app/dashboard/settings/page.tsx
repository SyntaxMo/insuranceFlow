import type { Metadata } from "next";
import Link from "next/link";
import { BackToDashboardLink } from "@/components/navigation/BackToDashboardLink";
import { ChangePasswordControl } from "@/components/profile/ChangePasswordControl";
import { DataDeletionControl } from "@/components/profile/DataDeletionControl";
import { Card } from "@/components/ui/Forms";
import { requireCustomer } from "@/lib/auth/session";
import { getCustomerDataDeletionRequest } from "@/lib/privacy/data-deletion";

export const metadata: Metadata = { title: "Settings | InsureFlow" };
export default async function SettingsPage() {
  const customer = await requireCustomer("settings");
  const deletion = await getCustomerDataDeletionRequest(customer.id);
  return <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
    <BackToDashboardLink />
    <header className="mt-5"><h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">Settings</h1><p className="mt-2 text-slate-600">Manage security, privacy, and browser preferences for your InsureFlow account.</p></header>
    <section className="mt-8" aria-labelledby="security-heading"><Card>
      <h2 id="security-heading" className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Security</h2>
      <div className="mt-5 flex items-center justify-between gap-4"><div className="flex items-center gap-4 text-sm"><span className="text-slate-600">Password</span><span aria-hidden="true" className="tracking-[0.18em]">••••••••</span><span className="sr-only">Password is set</span></div>{customer.email ? <ChangePasswordControl currentEmail={customer.email} /> : null}</div>
    </Card></section>
    <section className="mt-6" aria-labelledby="cookie-preferences-heading"><Card>
      <h2 id="cookie-preferences-heading" className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Cookie preferences</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">InsureFlow currently uses only essential cookies and browser storage required for security and application functionality.</p>
      <Link href="/cookies" className="mt-4 inline-block cursor-pointer rounded text-sm font-semibold text-[var(--brand-teal-deep)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">View Cookie Policy</Link>
    </Card></section>
    <section id="privacy" className="mt-6 scroll-mt-24" aria-labelledby="privacy-data-heading"><Card>
      <h2 id="privacy-data-heading" className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Privacy &amp; data</h2>
      <DataDeletionControl request={deletion.request} unavailable={deletion.unavailable} />
    </Card></section>
  </div>;
}
