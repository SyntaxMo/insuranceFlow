import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/RecoveryForms";
import { Card } from "@/components/ui/Forms";
import { getRecoveryClient } from "@/lib/auth/recovery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reset password | InsureFlow" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const valid = !params.error && Boolean(await getRecoveryClient());
  return <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:px-6 sm:py-16">
    <div className="mb-7 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--brand-navy)]">Set a new password</h1>
      <p className="mt-2 text-slate-600">Choose a new password for your InsureFlow account.</p>
    </div>
    <Card><ResetPasswordForm recoveryValid={valid} /></Card>
  </div>;
}
