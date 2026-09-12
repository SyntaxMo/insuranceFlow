import Link from "next/link";
import { LinkPolicyForm } from "@/components/dashboard/LinkPolicyForm";

export default function LinkPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-[var(--brand-teal)] hover:text-[var(--brand-teal-deep)]">
        ← Back to dashboard
      </Link>
      <div className="mb-7 mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Policies</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">Link an existing policy</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
          Enter the policy number and the email registered with the policy. Nothing will be linked until verification is complete.
        </p>
      </div>
      <LinkPolicyForm />
    </main>
  );
}
