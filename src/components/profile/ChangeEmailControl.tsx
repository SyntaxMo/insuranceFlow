"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  requestEmailChangeAction,
  type EmailChangeState,
} from "@/app/dashboard/profile/actions";
import { Button, TextInput } from "@/components/ui/Forms";

const initialState: EmailChangeState = {};

export function ChangeEmailControl() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function closeDialog() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-lg text-sm font-semibold text-[var(--brand-teal-deep)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
      >
        Change email
      </button>
      {open ? (
        <ChangeEmailDialog onClose={closeDialog} />
      ) : null}
    </>
  );
}

function ChangeEmailDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    requestEmailChangeAction,
    initialState,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const successCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = state.success
      ? successCloseRef.current
      : dialogRef.current?.querySelector<HTMLInputElement>("#new-email");
    target?.focus();
  }, [state.success]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  const fieldError = state.fields?.email?.[0];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-email-title"
        aria-describedby="change-email-description"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        {state.success && state.pendingEmail ? (
          <div role="status" aria-live="polite">
            <div
              className="flex size-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700"
              aria-hidden="true"
            >
              ✓
            </div>
            <h2
              id="change-email-title"
              className="mt-4 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]"
            >
              Check your new email
            </h2>
            <p id="change-email-description" className="mt-2 text-sm leading-6 text-slate-600">
              We sent a verification link to <strong>{state.pendingEmail}</strong>. Your email will change after verification.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Your current verified email remains active until Supabase completes the verification process.
            </p>
            <div className="mt-6 flex justify-end">
              <Button ref={successCloseRef} type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2
              id="change-email-title"
              className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]"
            >
              Change email address
            </h2>
            <p id="change-email-description" className="mt-2 text-sm leading-6 text-slate-600">
              We&apos;ll send a verification link to your new email address before the change takes effect.
            </p>
            <form action={formAction} className="mt-6">
              <label htmlFor="new-email" className="block text-sm font-medium text-slate-800">
                New email address
              </label>
              <TextInput
                id="new-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                required
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? "new-email-error" : undefined}
                className="mt-1.5"
                placeholder="new@example.com"
              />
              {fieldError ? (
                <p id="new-email-error" className="mt-1.5 text-sm text-rose-600" role="alert">
                  {fieldError}
                </p>
              ) : null}
              {state.message ? (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                  {state.message}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending} aria-busy={pending}>
                  {pending ? "Sending…" : "Send verification"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
