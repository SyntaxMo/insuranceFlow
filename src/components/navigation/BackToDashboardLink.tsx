import Link from "next/link";

export function BackToDashboardLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      aria-label="Back to dashboard"
      title="Back"
      className={`inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-150 hover:border-teal-200 hover:bg-teal-50 hover:text-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
        <path
          d="m14.5 6.5-5.5 5.5 5.5 5.5M9.5 12H20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
