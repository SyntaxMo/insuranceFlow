"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  requestEmailChangeAction,
  type EmailChangeState,
} from "@/app/dashboard/profile/actions";
import { Button, TextInput } from "@/components/ui/Forms";
import { PencilIcon } from "@/components/ui/PencilIcon";
import { preserveDialogFocus, trapDialogTab } from "@/lib/accessibility/focus";

const initialState: EmailChangeState = {};

export function ChangeEmailControl({ currentEmail }: { currentEmail: string }) {
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
        aria-label="Change email"
        title="Change email"
        onClick={() => setOpen(true)}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
      >
        <PencilIcon />
      </button>
      {open ? (
        <ChangeEmailDialog currentEmail={currentEmail} onClose={closeDialog} />
      ) : null}
    </>
  );
}

function ChangeEmailDialog({
  currentEmail,
  onClose,
}: {
  currentEmail: string;
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
    preserveDialogFocus(dialogRef.current);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
        return;
      }
      trapDialogTab(event, dialogRef.current);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  useEffect(() => {
    if (state.fields?.email?.length) dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

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
        tabIndex={-1}
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
              Confirm your email change
            </h2>
            <p id="change-email-description" className="mt-2 text-sm leading-6 text-slate-600">
              For your security, we sent confirmation links to your current and new email addresses. Your email will update after both are confirmed.
            </p>
            <dl className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div>
                <dt className="text-xs font-medium text-slate-500">Current email</dt>
                <dd className="mt-0.5 break-all text-sm font-medium text-[var(--brand-navy)]">{currentEmail}</dd>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <dt className="text-xs font-medium text-slate-500">New email</dt>
                <dd className="mt-0.5 break-all text-sm font-medium text-[var(--brand-navy)]">{state.pendingEmail}</dd>
              </div>
            </dl>
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
