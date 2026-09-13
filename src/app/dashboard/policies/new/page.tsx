import { randomUUID } from "node:crypto";
import Link from "next/link";
import { PolicyPurchaseWizard } from "@/components/dashboard/PolicyPurchaseWizard";
import { buttonClassName } from "@/components/ui/Forms";
import { requireCustomer } from "@/lib/auth/session";

export default async function NewPolicyPage() {
  const customer = await requireCustomer();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/dashboard" className={buttonClassName("secondary")}>← Back to dashboard</Link>
      <header className="mx-auto mb-7 mt-6 max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Motor insurance</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">Get a motor policy</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Build a deterministic demonstration quote, review it, and issue a simulated policy to your account.</p>
      </header>
      <PolicyPurchaseWizard customer={{ fullName: customer.full_name, email: customer.email }} requestId={randomUUID()} />
    </main>
  );
}
