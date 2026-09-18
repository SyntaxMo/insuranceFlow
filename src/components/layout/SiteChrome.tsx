import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { BrandLockup } from "@/components/brand/Brand";
import { CustomerAccountMenu } from "@/components/layout/CustomerAccountMenu";
import { buttonClassName } from "@/components/ui/Forms";
import { getAuthenticatedProfile, isStaffRole } from "@/lib/auth/session";

const navLinkClass = "rounded-lg px-1.5 py-2 text-sm font-medium text-slate-600 transition hover:text-[var(--brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]";

export async function SiteHeader() {
  const profile = await getAuthenticatedProfile();
  const isCustomer = profile?.role === "CUSTOMER";
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/88 shadow-[0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
        <Link
          href={isCustomer ? "/dashboard" : "/"}
          aria-label={isCustomer ? "InsureFlow dashboard" : "InsureFlow home"}
          className="group shrink-0 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
        >
          <BrandLockup compactOnMobile eager markClassName="size-10 transition-transform duration-300 group-hover:scale-[1.04]" />
        </Link>
        <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-2 sm:gap-3">
          {!profile ? <div className="mr-2 hidden items-center gap-4 lg:flex xl:gap-5"><Link href="/#coverage" className={navLinkClass}>Insurance</Link><Link href="/#how-it-works" className={navLinkClass}>How it works</Link><Link href="/#claims" className={navLinkClass}>Claims</Link><Link href="/#ai" className={navLinkClass}>AI</Link><Link href="/#help" className={navLinkClass}>Help</Link></div> : null}
          {isCustomer ? <CustomerAccountMenu customerName={profile.full_name} customerEmail={profile.email} /> : profile && isStaffRole(profile.role) ? <Link href="/admin/claims" className={navLinkClass}>Claims</Link> : <><Link href="/login" className={navLinkClass}>Sign in</Link><Link href="/signup" className={buttonClassName("primary", "min-h-9 whitespace-nowrap px-3 py-2 text-xs sm:px-4 sm:text-sm")}>Create account</Link></>}
          {profile && isStaffRole(profile.role) ? <form action={signOutAction}><button type="submit" className={buttonClassName("secondary", "min-h-9 whitespace-nowrap px-3 py-2 text-xs sm:px-4 sm:text-sm")}>Sign Out</button></form> : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/75">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-3"><BrandLockup markClassName="size-9" wordmarkClassName="text-lg" /><span className="hidden h-5 w-px bg-slate-200 md:block" /><p className="text-xs leading-5 text-slate-500 sm:text-sm">Motor insurance workflows, made clearer.</p></div>
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:items-end"><nav aria-label="Legal information" className="flex flex-wrap gap-x-4 gap-y-2"><Link href="/terms" className="rounded underline-offset-4 hover:text-[var(--brand-navy)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Terms</Link><Link href="/privacy" className="rounded underline-offset-4 hover:text-[var(--brand-navy)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Privacy</Link><Link href="/disclaimer" className="rounded underline-offset-4 hover:text-[var(--brand-navy)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">Disclaimer</Link></nav><p>© {new Date().getFullYear()} InsureFlow. Portfolio demonstration.</p></div>
      </div>
    </footer>
  );
}
