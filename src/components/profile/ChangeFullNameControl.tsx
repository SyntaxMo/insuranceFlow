"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateFullNameAction,
  type FullNameChangeState,
} from "@/app/dashboard/profile/actions";
import { Button, TextInput } from "@/components/ui/Forms";
import { PencilIcon } from "@/components/ui/PencilIcon";

const initialState: FullNameChangeState = {};

export function ChangeFullNameControl({ currentName }: { currentName: string }) {
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
        aria-label="Change full name"
        title="Change full name"
        onClick={() => setOpen(true)}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
      >
        <PencilIcon />
      </button>
      {open ? (
        <ChangeFullNameDialog currentName={currentName} onClose={closeDialog} />
      ) : null}
    </>
  );
}

function ChangeFullNameDialog({
  currentName,
  onClose,
}: {
  currentName: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateFullNameAction,
    initialState,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const successCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = state.success
      ? successCloseRef.current
      : dialogRef.current?.querySelector<HTMLInputElement>("#full-name");
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

  const fieldError = state.fields?.fullName?.[0];

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
        aria-labelledby="change-full-name-title"
        aria-describedby="change-full-name-description"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        {state.success ? (
          <div role="status" aria-live="polite">
            <div
              className="flex size-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700"
              aria-hidden="true"
            >
              ✓
            </div>
            <h2
              id="change-full-name-title"
              className="mt-4 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]"
            >
              Name updated successfully
            </h2>
            <p id="change-full-name-description" className="mt-2 text-sm leading-6 text-slate-600">
              Your profile now shows {state.fullName}.
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
              id="change-full-name-title"
              className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]"
            >
              Change full name
            </h2>
            <p id="change-full-name-description" className="mt-2 text-sm leading-6 text-slate-600">
              Update the name shown across your InsureFlow customer account.
            </p>
            <form action={formAction} className="mt-6">
              <label htmlFor="full-name" className="block text-sm font-medium text-slate-800">
                Full name
              </label>
              <TextInput
                id="full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                maxLength={100}
                required
                defaultValue={currentName}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? "full-name-error" : undefined}
                className="mt-1.5"
              />
              {fieldError ? (
                <p id="full-name-error" className="mt-1.5 text-sm text-rose-600" role="alert">
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
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
