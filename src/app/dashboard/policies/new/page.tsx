import Link from "next/link";
import { Card } from "@/components/ui/Forms";

export default function NewPolicyPlaceholderPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <Card className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Motor insurance</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">Get a policy</h1>
        <p className="mx-auto mt-3 max-w-lg text-slate-600">Online policy purchase is not available yet. We’ll add this flow in a future step.</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">Back to dashboard</Link>
      </Card>
    </main>
  );
}
