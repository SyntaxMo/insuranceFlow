"use client";

import { useEffect, useState } from "react";

export function ConfirmationToast() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Remove the one-time marker without navigating and unmounting the toast.
    window.history.replaceState(window.history.state, "", "/dashboard");
    const timeout = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

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
      Your email has been confirmed.
    </div>
  );
}
