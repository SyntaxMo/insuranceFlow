import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/AuthForms";
import { Card } from "@/components/ui/Forms";
import { getAuthenticatedProfile, routeForRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const profile = await getAuthenticatedProfile();
  if (profile) redirect(routeForRole(profile.role));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-7 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Customer registration</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[var(--brand-navy)]">Create your account</h1>
        <p className="mt-2 text-slate-600">Register to view your policies and manage your claims.</p>
      </div>
      <Card><SignupForm /></Card>
    </div>
  );
}
