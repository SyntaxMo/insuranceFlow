import { ForgotPasswordForm } from "@/components/auth/RecoveryForms";
import { Card } from "@/components/ui/Forms";

export default function ForgotPasswordPage() {
  return <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:px-6 sm:py-16">
    <div className="mb-7 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--brand-navy)]">Reset your password</h1>
      <p className="mt-2 text-slate-600">Enter your account email and we’ll send you a password reset link.</p>
    </div>
    <Card><ForgotPasswordForm /></Card>
  </div>;
}
