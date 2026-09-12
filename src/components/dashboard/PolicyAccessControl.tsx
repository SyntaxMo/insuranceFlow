"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  removeLinkedPolicyAction,
  type RemovePolicyState,
} from "@/app/dashboard/policies/actions";
import { Alert, Button } from "@/components/ui/Forms";

const initialState: RemovePolicyState = {};

export function PolicyAccessControl({
  policyId,
  presentation = "menu",
  inverse = false,
}: {
  policyId: string;
  presentation?: "menu" | "button";
  inverse?: boolean;
}) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState(
    removeLinkedPolicyAction,
    initialState,
  );

  function openConfirmation() {
    setMenuOpen(false);
    setModalOpen(true);
  }

  function closeConfirmation() {
    if (pending) return;
    setModalOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        setModalOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, pending]);

  return (
    <>
      {presentation === "menu" ? (
        <div ref={menuRootRef} className="relative">
          <button
            ref={triggerRef}
            type="button"
            className={`flex size-9 items-center justify-center rounded-lg text-xl leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${inverse ? "text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-white" : "text-slate-500 hover:bg-slate-100 hover:text-[var(--brand-navy)] focus-visible:outline-slate-400"}`}
            aria-label="Policy management options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setMenuOpen(true);
                window.requestAnimationFrame(() => menuItemRef.current?.focus());
              }
            }}
          >
            <span aria-hidden="true">•••</span>
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <button
                ref={menuItemRef}
                type="button"
                role="menuitem"
                onClick={openConfirmation}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Remove from account
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <Button ref={triggerRef} type="button" variant="danger" onClick={openConfirmation}>
          Remove from account
        </Button>
      )}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirmation();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`remove-policy-title-${policyId}`}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              if (event.shiftKey && document.activeElement === cancelRef.current) {
                event.preventDefault();
                removeRef.current?.focus();
              } else if (!event.shiftKey && document.activeElement === removeRef.current) {
                event.preventDefault();
                cancelRef.current?.focus();
              }
            }}
          >
            <h2
              id={`remove-policy-title-${policyId}`}
              className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]"
            >
              Remove policy from your account?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This will remove access to this policy from your InsureFlow account. It will not cancel the insurance policy.
            </p>
            {state.message ? (
              <div className="mt-4">
                <Alert tone="error">{state.message}</Alert>
              </div>
            ) : null}
            <form action={action} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <input type="hidden" name="policyId" value={policyId} />
              <Button
                ref={cancelRef}
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={closeConfirmation}
              >
                Cancel
              </Button>
              <Button ref={removeRef} type="submit" variant="danger" disabled={pending}>
                {pending ? "Removing…" : "Remove from account"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
