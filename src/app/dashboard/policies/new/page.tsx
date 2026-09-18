import { randomUUID } from "node:crypto";
import { PolicyPurchaseWizard } from "@/components/dashboard/PolicyPurchaseWizard";
import { BackToDashboardLink } from "@/components/navigation/BackToDashboardLink";
import { requireCustomer } from "@/lib/auth/session";

export default async function NewPolicyPage() {
  const customer = await requireCustomer();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <BackToDashboardLink />
      <header className="mb-8 mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Motor insurance</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">Get a motor policy</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Build a deterministic demonstration quote, review it, and issue a simulated policy to your account.</p>
      </header>
      <PolicyPurchaseWizard customer={{ fullName: customer.full_name, email: customer.email }} requestId={randomUUID()} />
    </main>
  );
}
