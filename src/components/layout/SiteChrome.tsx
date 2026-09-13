import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { getAuthenticatedProfile, isStaffRole } from "@/lib/auth/session";

export async function SiteHeader() {
  const profile = await getAuthenticatedProfile();
  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-navy)] text-sm font-semibold tracking-wide text-white shadow-sm transition group-hover:bg-[var(--brand-navy-deep)]">
            IF
          </span>
          <span className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--brand-navy)]">
            InsureFlow
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
          {profile?.role === "CUSTOMER" ? (
            <>
              <Link href="/dashboard" className="transition hover:text-[var(--brand-navy)]">Dashboard</Link>
              <Link href="/claim" className="transition hover:text-[var(--brand-navy)]">New Claim</Link>
            </>
          ) : profile && isStaffRole(profile.role) ? (
            <Link href="/admin/claims" className="transition hover:text-[var(--brand-navy)]">Claims</Link>
          ) : (
            <>
              <Link href="/login" className="transition hover:text-[var(--brand-navy)]">Sign in</Link>
              <Link href="/signup" className="rounded-lg border border-slate-200 px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-50">Register</Link>
            </>
          )}
          {profile ? (
            <form action={signOutAction}>
              <button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-50">Sign Out</button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} InsureFlow. Motor claims made clear.</p>
        <nav aria-label="Legal information" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/terms" className="rounded underline-offset-4 hover:text-[var(--brand-navy)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Terms</Link>
          <Link href="/privacy" className="rounded underline-offset-4 hover:text-[var(--brand-navy)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Privacy</Link>
          <Link href="/disclaimer" className="rounded underline-offset-4 hover:text-[var(--brand-navy)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Disclaimer</Link>
        </nav>
      </div>
    </footer>
  );
}
