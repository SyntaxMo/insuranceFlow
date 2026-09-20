"use client";

import { useEffect, useState } from "react";

export function ConfirmationToast({
  message = "Your email has been confirmed.",
  marker = "confirmed",
  tone = "success",
}: {
  message?: string;
  marker?: string;
  tone?: "success" | "info";
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

  const toneClass = tone === "success"
    ? "border-emerald-200 text-emerald-800"
    : "border-sky-200 text-sky-800";
  const iconClass = tone === "success"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-sky-100 text-sky-700";

  return (
    <div
      className={`fixed right-4 top-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg sm:right-6 sm:top-6 ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        aria-hidden="true"
      >
        {tone === "success" ? "✓" : "i"}
      </span>
      {message}
    </div>
  );
}
