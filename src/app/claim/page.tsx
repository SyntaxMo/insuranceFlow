import { ClaimWizard } from "@/components/claim/ClaimWizard";

export default function ClaimPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">
          Claim intake
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">
          Start your motor claim
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Complete each step to verify your policy, describe the accident,
          attach documents, and submit for review.
        </p>
      </div>
      <ClaimWizard />
    </div>
  );
}
