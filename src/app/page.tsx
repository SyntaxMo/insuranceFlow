import Link from "next/link";

export default function HomePage() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[var(--brand-mist)]/70 blur-3xl" />
        <div className="absolute -right-16 top-40 h-80 w-80 rounded-full bg-[var(--brand-teal-soft)]/80 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-24 lg:min-h-[calc(100vh-8.5rem)] lg:py-28">
        <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--brand-navy)] sm:text-6xl lg:text-7xl">
          InsureFlow
        </p>
        <h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Motor Insurance Claims
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
          File a motor claim in minutes. Verify your policy, share accident
          details, attach documents, and receive a claim number for review.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-teal)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
          >
            Create customer account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
