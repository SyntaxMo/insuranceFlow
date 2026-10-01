import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/AuthForms";
import { Card } from "@/components/ui/Forms";
import { Alert } from "@/components/ui/Forms";
import { getAuthenticatedProfile } from "@/lib/auth/session";
import { signInDestination } from "@/lib/auth/destinations";

export const dynamic = "force-dynamic";

const confirmationErrors: Record<string, string> = {
  "expired-confirmation":
    "This confirmation link has expired. Request a new confirmation email or sign up again.",
  "invalid-confirmation": "This confirmation link is invalid.",
  "missing-profile":
    "Your email was confirmed, but your InsureFlow profile could not be found. Contact support.",
  "session-exchange":
    "We could not start your session from that confirmation link. Please try the link again or sign in.",
  confirmation: "That confirmation link is invalid or has expired.",
};

export const metadata: Metadata = { title: "Sign in | InsureFlow" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const profile = await getAuthenticatedProfile();
  const params = await searchParams;
  if (profile) redirect(signInDestination(profile.role, params.next));
  const confirmationError = params.error
    ? confirmationErrors[params.error]
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-7 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Secure access</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[var(--brand-navy)]">Welcome back</h1>
        <p className="mt-2 text-slate-600">Customers and claims staff use the same secure sign-in.</p>
      </div>
      {confirmationError ? (
        <div className="mb-4">
          <Alert tone="error">{confirmationError}</Alert>
        </div>
      ) : null}
      <Card><LoginForm next={params.next === "settings" ? "settings" : undefined} /></Card>
    </div>
  );
}
