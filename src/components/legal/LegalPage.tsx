import Link from "next/link";
import { getAuthenticatedProfile, routeForRole } from "@/lib/auth/session";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export async function getLegalPageNavigation(): Promise<{
  returnHref: "/" | "/dashboard" | "/admin";
  returnLabel: string;
}> {
  const profile = await getAuthenticatedProfile();
  return {
    returnHref: profile ? routeForRole(profile.role) : "/",
    returnLabel: profile
      ? profile.role === "CUSTOMER"
        ? "Back to dashboard"
        : "Back to admin"
      : "Back to InsureFlow",
  };
}

export function LegalPage({
  title,
  introduction,
  sections,
  returnHref,
  returnLabel,
}: {
  title: string;
  introduction: string;
  sections: LegalSection[];
  returnHref: "/" | "/dashboard" | "/admin";
  returnLabel: string;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <Link href={returnHref} className="inline-flex rounded-lg text-sm font-semibold text-[var(--brand-teal)] underline-offset-4 hover:text-[var(--brand-teal-deep)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-teal)]">← {returnLabel}</Link>
      <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_55px_-40px_rgba(15,23,42,0.5)]">
        <header className="border-b border-slate-100 bg-slate-50/70 px-5 py-7 sm:px-8 sm:py-9">
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--brand-navy)] sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{introduction}</p>
        </header>
        <div className="space-y-8 px-5 py-7 sm:px-8 sm:py-9">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={`legal-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              <h2 id={`legal-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)] sm:text-2xl">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets ? <ul className="list-disc space-y-2 pl-5 marker:text-[var(--brand-teal)]">{section.bullets.map((item) => <li key={item} className="pl-1">{item}</li>)}</ul> : null}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
