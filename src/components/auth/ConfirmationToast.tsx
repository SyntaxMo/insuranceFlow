"use client";

import { useEffect, useState } from "react";

export function ConfirmationToast({
  message = "Your email has been confirmed.",
  marker = "confirmed",
}: {
  message?: string;
  marker?: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Consume only this one-time marker without navigating or losing other state.
    const url = new URL(window.location.href);
    url.searchParams.delete(marker);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    const timeout = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [marker]);

  if (!visible) return null;

  return (
    <div
      className="fixed right-4 top-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg sm:right-6 sm:top-6"
      role="status"
      aria-live="polite"
    >
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        aria-hidden="true"
      >
        ✓
      </span>
      {message}
    </div>
  );
}
