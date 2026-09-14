import Image from "next/image";
import Link from "next/link";
import { HelpFaq } from "@/components/marketing/HelpFaq";
import { HeroCoverageStory } from "@/components/marketing/HeroCoverageStory";
import { Reveal } from "@/components/marketing/Reveal";
import { buttonClassName } from "@/components/ui/Forms";

const steps = [
  ["01", "Add your vehicle", "Enter essential vehicle details using a focused, guided flow."],
  ["02", "Choose coverage", "Compare simplified Comprehensive and Third Party options."],
  ["03", "Review your quote", "See deterministic demo pricing before confirming the details."],
  ["04", "Manage it online", "Your issued demo policy appears directly in your customer dashboard."],
];

const features = [
  "View all accessible policies",
  "Link an existing policy",
  "Get a new demo policy",
  "File and track claims",
  "Upload supporting documents",
  "Follow clear status updates",
];

const coverageComparisonRows = [
  ["Your vehicle damage", "Example protection", "Generally not included"],
  ["Third-party liability", "Included in simplified demo", "Primary focus"],
  ["Demo excess", "BHD 150", "BHD 0"],
  ["Demo coverage limit", "Vehicle value", "BHD 100,000"],
];

function CheckIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none"><path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function HomePage() {
  return (
    <div className="overflow-x-clip bg-[#f7fafb]">
      <HeroCoverageStory />

      <section aria-labelledby="coverage-comparison-title" className="bg-[#f7fafb] px-4 pb-20 pt-6 sm:px-6 sm:pb-24 lg:px-8">
        <Reveal className="mx-auto w-full max-w-5xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-teal)]">At a glance</p>
            <h2 id="coverage-comparison-title" className="mt-3 text-2xl font-bold tracking-[-0.03em] text-[var(--brand-navy)] sm:text-3xl">A simpler side-by-side view.</h2>
          </div>

          <div className="mt-8" role="table" aria-label="Simplified coverage comparison">
            <div role="row" className="hidden grid-cols-[1.1fr_1fr_1fr] gap-6 border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-[0.09em] text-slate-500 sm:grid">
              <span role="columnheader">Feature</span><span role="columnheader">Comprehensive</span><span role="columnheader">Third Party</span>
            </div>
            {coverageComparisonRows.map(([feature, comprehensive, thirdParty]) => (
              <div key={feature} role="row" className="grid gap-3 border-b border-slate-200/80 py-5 sm:grid-cols-[1.1fr_1fr_1fr] sm:gap-6">
                <p role="rowheader" className="text-sm font-semibold text-[var(--brand-navy)]">{feature}</p>
                <p role="cell" className="text-sm text-slate-600"><span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--brand-teal)] sm:hidden">Comprehensive</span>{comprehensive}</p>
                <p role="cell" className="text-sm text-slate-600"><span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:hidden">Third Party</span>{thirdParty}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">This is a simplified demonstration comparison. Actual insurance coverage depends on policy terms and conditions.</p>

          <div className="mt-10 flex flex-col items-start justify-between gap-5 border-t border-teal-100 pt-8 sm:flex-row sm:items-center">
            <div><h3 className="text-lg font-semibold text-[var(--brand-navy)]">Not sure which fits you?</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Create an account to get personalized guidance based on your vehicle and preferences.</p></div>
            <Link href="/signup" className={buttonClassName("primary", "shrink-0 px-5 py-3")}>Create account</Link>
          </div>
        </Reveal>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <Reveal className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-teal)]">How it works</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-[var(--brand-navy)] sm:text-4xl">A straightforward path from vehicle to policy.</h2><p className="mt-4 text-base leading-7 text-slate-600">Every step is designed to keep the information clear and the customer in control.</p></Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map(([number, title, copy], index) => <Reveal key={number} delay={index * 80} className="h-full"><article className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.5)]"><p className="text-sm font-bold text-[var(--brand-teal)]">{number}</p><h3 className="mt-8 text-lg font-semibold tracking-[-0.02em] text-[var(--brand-navy)]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></article></Reveal>)}</div>
        </div>
      </section>

      <section id="claims" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <Reveal direction="left"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-teal)]">Everything in one place</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-[var(--brand-navy)] sm:text-4xl">Policies and claims, connected.</h2><p className="mt-4 text-base leading-7 text-slate-600">Use one customer portal to access the workflows already built into InsureFlow.</p><ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{features.map((feature) => <li key={feature} className="flex items-center gap-3 text-sm font-medium text-slate-700"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[var(--brand-teal)]"><CheckIcon /></span>{feature}</li>)}</ul></Reveal>
          <Reveal direction="right" delay={100}>
            <div className="rounded-[1.75rem] border border-slate-200 bg-[#f5f8fa] p-3 shadow-[0_32px_80px_-48px_rgba(15,23,42,0.6)] sm:p-5"><div className="rounded-2xl bg-white p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Customer dashboard</p><h3 className="mt-2 text-xl font-bold text-[var(--brand-navy)] sm:text-2xl">Welcome back, Maya</h3></div><div className="flex gap-2"><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong className="block text-base text-[var(--brand-navy)]">2</strong>Policies</span><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong className="block text-base text-[var(--brand-navy)]">1</strong>Open claim</span></div></div>
              <div className="mt-5 grid gap-4 md:grid-cols-[1.25fr_0.75fr]"><article className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">MOT-2026-0101</p><p className="mt-1 font-semibold text-[var(--brand-navy)]">Toyota RAV4 (2023)</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-slate-500">Coverage</dt><dd className="mt-1 font-medium text-slate-800">Comprehensive</dd></div><div><dt className="text-xs text-slate-500">Annual premium</dt><dd className="mt-1 font-medium text-slate-800">BHD 171</dd></div></dl><div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><span className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[var(--brand-navy)]">View policy</span><span className="rounded-lg bg-[var(--brand-teal)] px-3 py-2 text-xs font-semibold text-white">Make a claim</span></div></article><article className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Latest claim</p><p className="mt-1 font-semibold text-[var(--brand-navy)]">CLM-2026-1842</p><span className="mt-4 inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">Under review</span><p className="mt-4 text-xs leading-5 text-slate-500">Documents received and ready for claims-team review.</p></article></div>
            </div></div>
          </Reveal>
        </div>
      </section>

      <section id="ai" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal className="mx-auto grid w-full max-w-7xl items-center gap-10 rounded-[2rem] bg-[var(--brand-navy)] px-5 py-10 text-white shadow-[0_30px_80px_-50px_rgba(5,42,66,0.85)] sm:px-10 sm:py-14 lg:grid-cols-2 lg:px-14">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">Human in the loop</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">AI-assisted claims, human decisions.</h2><p className="mt-4 max-w-xl leading-7 text-slate-300">AI helps claims staff organize supplied information and documents. It supports review; it never approves or rejects a claim.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{["Summarize documents", "Identify missing information", "Flag inconsistencies", "Highlight review risks"].map((item, index) => <Reveal key={item} delay={80 + index * 65}><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><span className="flex size-8 items-center justify-center rounded-full bg-teal-400/15 text-teal-200"><CheckIcon /></span><p className="mt-4 text-sm font-semibold text-white">{item}</p></div></Reveal>)}</div>
        </Reveal>
      </section>

      <section id="help" className="scroll-mt-24 bg-white px-4 pb-20 pt-20 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8">
        <Reveal><HelpFaq /></Reveal>

        <div className="mx-auto mt-16 w-full max-w-5xl border-t border-slate-200/80 pt-16 sm:mt-20 sm:pt-20">
          <Reveal direction="scale" className="text-center">
            <Image src="/brand/insureflow-mark.webp" alt="" width={44} height={44} className="mx-auto size-11 object-contain opacity-90" />
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.035em] text-[var(--brand-navy)] sm:text-4xl">Ready to explore InsureFlow?</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">Create a demo account and experience connected digital policy and claim workflows.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 min-[430px]:flex-row">
              <Link href="/signup" className={buttonClassName("primary", "px-6 py-3.5 text-base")}>Create account</Link>
              <Link href="/login" className={buttonClassName("secondary", "bg-white px-6 py-3.5 text-base")}>Sign in</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
