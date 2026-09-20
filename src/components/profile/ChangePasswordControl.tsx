"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  requestPasswordChangeCodeAction,
  updatePasswordAction,
  type PasswordChangeState,
  type PasswordCodeRequestState,
} from "@/app/dashboard/profile/actions";
import { Button, TextInput } from "@/components/ui/Forms";
import { PencilIcon } from "@/components/ui/PencilIcon";

const initialRequestState: PasswordCodeRequestState = {};
const initialPasswordState: PasswordChangeState = {};

export function ChangePasswordControl({ currentEmail }: { currentEmail: string }) {
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
        aria-label="Change password"
        title="Change password"
        onClick={() => setOpen(true)}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
      >
        <PencilIcon />
      </button>
      {open ? (
        <ChangePasswordDialog currentEmail={currentEmail} onClose={closeDialog} />
      ) : null}
    </>
  );
}

function ChangePasswordDialog({
  currentEmail,
  onClose,
}: {
  currentEmail: string;
  onClose: () => void;
}) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestPasswordChangeCodeAction,
    initialRequestState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updatePasswordAction,
    initialPasswordState,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestButtonRef = useRef<HTMLButtonElement>(null);
  const successCloseRef = useRef<HTMLButtonElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientCodeError, setClientCodeError] = useState<string>();
  const [clientConfirmationError, setClientConfirmationError] = useState<string>();
  const pending = requestPending || passwordPending;

  useEffect(() => {
    const target = passwordState.success
      ? successCloseRef.current
      : requestState.success
        ? dialogRef.current?.querySelector<HTMLInputElement>("#password-verification-code")
        : requestButtonRef.current;
    target?.focus();
  }, [passwordState.success, requestState.success]);

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

  const codeError = clientCodeError ?? passwordState.fields?.verificationCode?.[0];
  const passwordError = passwordState.fields?.password?.[0];
  const confirmationError =
    clientConfirmationError ?? passwordState.fields?.confirmPassword?.[0];

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
        aria-labelledby="change-password-title"
        aria-describedby="change-password-description"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        {passwordState.success ? (
          <div role="status" aria-live="polite">
            <div
              className="flex size-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700"
              aria-hidden="true"
            >
              ✓
            </div>
            <h2
              id="change-password-title"
              className="mt-4 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]"
            >
              Password updated
            </h2>
            <p id="change-password-description" className="mt-2 text-sm leading-6 text-slate-600">
              Your new password is ready to use.
            </p>
            <div className="mt-6 flex justify-end">
              <Button ref={successCloseRef} type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : requestState.success ? (
          <>
            <h2
              id="change-password-title"
              className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]"
            >
              Set a new password
            </h2>
            <p id="change-password-description" className="mt-2 text-sm leading-6 text-slate-600">
              Enter the code sent to your account email, then choose your new password.
            </p>
            <p className="mt-3 break-all text-sm font-medium text-[var(--brand-navy)]">
              {currentEmail}
            </p>
            <form
              action={passwordAction}
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                setClientCodeError(undefined);
                setClientConfirmationError(undefined);
                if (!/^\d{8}$/.test(verificationCode)) {
                  event.preventDefault();
                  setClientCodeError("Enter the 8-digit verification code.");
                  codeRef.current?.focus();
                  return;
                }
                if (password !== confirmPassword) {
                  event.preventDefault();
                  setClientConfirmationError("Passwords do not match.");
                  confirmationRef.current?.focus();
                }
              }}
            >
              <div>
                <label htmlFor="password-verification-code" className="block text-sm font-medium text-slate-800">
                  Verification code
                </label>
                <TextInput
                  ref={codeRef}
                  id="password-verification-code"
                  name="verificationCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) => {
                    setVerificationCode(event.target.value);
                    setClientCodeError(undefined);
                  }}
                  required
                  aria-invalid={codeError ? true : undefined}
                  aria-describedby={codeError ? "password-verification-code-error" : undefined}
                  className="mt-1.5"
                />
                {codeError ? (
                  <p id="password-verification-code-error" className="mt-1.5 text-sm text-rose-600" role="alert">
                    {codeError}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-800">
                  New password
                </label>
                <TextInput
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? "new-password-error" : "new-password-hint"}
                  className="mt-1.5"
                />
                {passwordError ? (
                  <p id="new-password-error" className="mt-1.5 text-sm text-rose-600" role="alert">
                    {passwordError}
                  </p>
                ) : (
                  <p id="new-password-hint" className="mt-1.5 text-xs text-slate-500">
                    Use at least 8 characters.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="block text-sm font-medium text-slate-800">
                  Confirm new password
                </label>
                <TextInput
                  ref={confirmationRef}
                  id="confirm-new-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  required
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setClientConfirmationError(undefined);
                  }}
                  aria-invalid={confirmationError ? true : undefined}
                  aria-describedby={confirmationError ? "confirm-new-password-error" : undefined}
                  className="mt-1.5"
                />
                {confirmationError ? (
                  <p id="confirm-new-password-error" className="mt-1.5 text-sm text-rose-600" role="alert">
                    {confirmationError}
                  </p>
                ) : null}
              </div>
              {passwordState.message ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                  {passwordState.message}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending} aria-busy={passwordPending}>
                  {passwordPending ? "Updating…" : "Change password"}
                </Button>
              </div>
            </form>
            <form action={requestAction} className="mt-3 text-center">
              <button
                type="submit"
                disabled={pending}
                className="cursor-pointer rounded px-2 py-1 text-sm font-semibold text-[var(--brand-teal-deep)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestPending ? "Sending…" : "Resend code"}
              </button>
              {requestState.message ? (
                <p className="mt-2 text-sm text-rose-700" role="alert">
                  {requestState.message}
                </p>
              ) : null}
            </form>
          </>
        ) : (
          <>
            <h2
              id="change-password-title"
              className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]"
            >
              Verify before changing your password
            </h2>
            <p id="change-password-description" className="mt-2 text-sm leading-6 text-slate-600">
              We&apos;ll send a verification code to your account email.
            </p>
            <p className="mt-3 break-all text-sm font-medium text-[var(--brand-navy)]">
              {currentEmail}
            </p>
            {requestState.message ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                {requestState.message}
              </p>
            ) : null}
            <form action={requestAction} className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button ref={requestButtonRef} type="submit" disabled={pending} aria-busy={requestPending}>
                {requestPending ? "Sending…" : "Send code"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
