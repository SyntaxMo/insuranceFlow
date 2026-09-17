"use client";

import { useEffect } from "react";

export function CustomerClaimSubmissionSuccess() {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("submitted");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  return (
    <div
      className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900 sm:px-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700"
          aria-hidden="true"
        >
          ✓
        </span>
        <div>
          <p className="font-semibold">Information submitted successfully</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Your response and files were sent to the claims team. Your claim is now back under review.
          </p>
        </div>
      </div>
    </div>
  );
}
