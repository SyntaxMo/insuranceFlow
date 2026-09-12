"use client";

import { useActionState, useState } from "react";
import {
  removeLinkedPolicyAction,
  type RemovePolicyState,
} from "@/app/dashboard/policies/actions";
import { Alert, Button } from "@/components/ui/Forms";

const initialState: RemovePolicyState = {};

export function PolicyAccessControl({
  policyId,
  presentation = "menu",
}: {
  policyId: string;
  presentation?: "menu" | "button";
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [state, action, pending] = useActionState(
    removeLinkedPolicyAction,
    initialState,
  );

  function openConfirmation() {
    setMenuOpen(false);
    setModalOpen(true);
  }

  return (
    <>
      {presentation === "menu" ? (
        <div className="relative">
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-lg text-xl leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            aria-label="Policy management options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">•••</span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <button
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
        <Button type="button" variant="danger" onClick={openConfirmation}>
          Remove from account
        </Button>
      )}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`remove-policy-title-${policyId}`}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
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
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={pending}>
                {pending ? "Removing…" : "Remove from account"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
