"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { buttonClassName } from "@/components/ui/Forms";
import {
  hasCurrentCookieNoticeAcknowledgement,
  storeCookieNoticeAcknowledgement,
} from "@/lib/privacy/cookie-notice";

const COOKIE_NOTICE_EVENT = "insureflow-cookie-notice-change";

function subscribeToAcknowledgement(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(COOKIE_NOTICE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(COOKIE_NOTICE_EVENT, onStoreChange);
  };
}

export function PublicCookieNotice() {
  const acknowledged = useSyncExternalStore(
    subscribeToAcknowledgement,
    () => hasCurrentCookieNoticeAcknowledgement(window.localStorage),
    () => true,
  );
  const [dismissedForPage, setDismissedForPage] = useState(false);

  if (acknowledged || dismissedForPage) return null;

  return (
    <aside
      aria-labelledby="cookie-notice-title"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_55px_-22px_rgba(15,23,42,0.35)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:p-5"
    >
      <h2 id="cookie-notice-title" className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--brand-navy)]">
        Cookies on InsureFlow
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        We use essential cookies and browser storage to keep InsureFlow secure and working properly. We do not currently use advertising or analytics cookies.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={buttonClassName("primary", "cursor-pointer px-4")}
          onClick={() => {
            try {
              storeCookieNoticeAcknowledgement(window.localStorage);
            } finally {
              setDismissedForPage(true);
              window.dispatchEvent(new Event(COOKIE_NOTICE_EVENT));
            }
          }}
        >
          Got it
        </button>
        <Link
          href="/cookies"
          className="rounded-lg px-2 py-2 text-sm font-semibold text-[var(--brand-teal-deep)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
        >
          Cookie policy
        </Link>
      </div>
    </aside>
  );
}
