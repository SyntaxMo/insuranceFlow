"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { ProfileIcon } from "@/components/ui/ProfileIcon";

type CustomerAccountMenuProps = {
  customerName: string | null;
  customerEmail: string | null;
};

export function CustomerAccountMenu({
  customerName,
  customerEmail,
}: CustomerAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const displayName = customerName?.trim() || "Customer";

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function moveMenuFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-account-menu-item]"),
    );
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(current + step + items.length) % items.length]?.focus();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex size-10 cursor-pointer items-center justify-center rounded-full text-white shadow-sm ring-2 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${
          open
            ? "bg-slate-700 ring-[var(--brand-teal)]"
            : "bg-[var(--brand-navy)] ring-white hover:bg-slate-700 hover:ring-slate-200"
        }`}
      >
        <ProfileIcon />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account navigation"
          onKeyDown={moveMenuFocus}
          className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_55px_-20px_rgba(15,23,42,0.35)]"
        >
          <div className="border-b border-slate-100 px-3 py-3">
            <p className="truncate text-sm font-semibold text-[var(--brand-navy)]">{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{customerEmail?.trim() || "Email not available"}</p>
          </div>
          <div className="py-1">
            <Link ref={firstItemRef} role="menuitem" data-account-menu-item href="/dashboard/profile" onClick={() => setOpen(false)} className="block cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[var(--brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-teal)]">Profile</Link>
          </div>
          <form action={signOutAction} className="border-t border-slate-100 pt-1">
            <button role="menuitem" data-account-menu-item type="submit" className="w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[var(--brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-teal)]">Sign out</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
