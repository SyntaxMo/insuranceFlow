import Link from "next/link";
import { Card } from "@/components/ui/Forms";
import { requireCustomer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ClaimSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ claimNumber?: string }>;
}) {
  await requireCustomer();
  const params = await searchParams;
  const claimNumber = params.claimNumber?.trim();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-14 sm:px-6">
      <Card className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">
          Claim submitted successfully
        </h1>
        {claimNumber ? (
          <p className="text-lg text-slate-800">
            Your claim number is{" "}
            <span className="font-semibold tracking-wide text-[var(--brand-navy)]">
              {claimNumber}
            </span>
          </p>
        ) : (
          <p className="text-slate-700">
            Your claim was received. Keep your confirmation email for reference.
          </p>
        )}
        <p className="text-slate-600">
          Your claim is pending review. Our team will assess the submitted
          details and documents. No further action is needed right now.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-teal)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-teal-deep)]"
          >
            Return to dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
