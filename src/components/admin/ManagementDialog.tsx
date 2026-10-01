"use client";
import { startTransition, useActionState, useEffect, useRef, useState, type MouseEvent } from "react";
import { transitionDeletionRequestAction, updateClaimsOfficerAction } from "@/app/admin/management-actions";
import { Button, Field, TextArea, TextInput } from "@/components/ui/Forms";
import { isolateDialogBackground, preserveDialogFocus, trapDialogTab } from "@/lib/accessibility/focus";
import type { AdminRequest, ClaimsOfficerAccount, ManagementState } from "@/lib/admin/types";

type Operation = { kind: "staff"; officer: ClaimsOfficerAccount } | { kind: "request"; request: AdminRequest; action: "process" | "reject" | "complete" };
const actionNames = { process: "Start processing", reject: "Reject request", complete: "Mark completed" };

export function RequestManagementActions({ request }: { request: AdminRequest }) {
  const [operation, setOperation] = useState<Operation | null>(null);
  const group = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const actions: Array<"process" | "reject" | "complete"> = request.status === "PENDING" ? ["process", "reject"] : request.status === "PROCESSING" ? ["complete"] : [];
  function close() {
    setOperation(null);
    window.setTimeout(() => (trigger.current?.isConnected ? trigger.current : group.current)?.focus({ preventScroll: true }), 0);
  }
  function openAction(event: MouseEvent<HTMLButtonElement>) {
    const action = event.currentTarget.dataset.action;
    if (action !== "process" && action !== "reject" && action !== "complete") return;
    trigger.current = event.currentTarget;
    setOperation({ kind: "request", request, action });
  }
  // Keep the dialog independent of the source-status buttons. Revalidation may
  // replace those buttons while the successful result is still being read.
  return <><div ref={group} role="group" aria-label="Deletion request actions" tabIndex={-1} className="flex flex-wrap gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">
    {actions.length ? actions.map(action => <Button key={action} data-action={action} type="button" variant="secondary" className="cursor-pointer whitespace-nowrap" onClick={openAction}>{actionNames[action]}</Button>) : <span className="text-sm text-slate-600">Read-only history</span>}
  </div>{operation ? <ManagementDialog operation={operation} onClose={close} /> : null}</>;
}
export function StaffManagementControl({ officer }: { officer: ClaimsOfficerAccount }) { return <ManagementControl operation={{ kind: "staff", officer }} />; }

function ManagementControl({ operation }: { operation: Operation }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); window.setTimeout(() => trigger.current?.focus({ preventScroll: true }), 0); }
  return <><Button ref={trigger} type="button" variant="secondary" className="cursor-pointer whitespace-nowrap" onClick={() => setOpen(true)}>{operation.kind === "staff" ? "Manage" : actionNames[operation.action]}</Button>{open ? <ManagementDialog operation={operation} onClose={close} /> : null}</>;
}

function ManagementDialog({ operation, onClose }: { operation: Operation; onClose: () => void }) {
  const [state, action, pending] = useActionState<ManagementState, FormData>(operation.kind === "staff" ? updateClaimsOfficerAction : transitionDeletionRequestAction, {});
  const [fullName, setFullName] = useState(operation.kind === "staff" ? operation.officer.fullName : "");
  const [email, setEmail] = useState(operation.kind === "staff" ? operation.officer.email : "");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const title = operation.kind === "staff" ? "Manage Claims Officer" : actionNames[operation.action];
  useEffect(() => isolateDialogBackground(dialog.current), []);
  useEffect(() => { (state.success ? done.current : cancel.current)?.focus(); }, [state.success]);
  useEffect(() => { if (state.fields) dialog.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [state]);
  useEffect(() => {
    preserveDialogFocus(dialog.current);
    function onKey(event: KeyboardEvent) { if (event.key === "Escape" && !pending) { event.preventDefault(); onClose(); } else trapDialogTab(event, dialog.current); }
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="management-title" aria-describedby="management-description" tabIndex={-1} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
      <h2 id="management-title" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">{state.success ? "Changes saved" : title}</h2>
      <p id="management-description" className="mt-2 text-sm leading-6 text-slate-600">{operation.kind === "staff" ? "Update only organization-managed name and work email. Changing the work email immediately changes this staff member’s sign-in address; confirm it is an authorized work address. Role and password are not editable here." : `${operation.request.customerName} — ${operation.action === "process" ? "Starting processing prevents customer cancellation. No account data will be deleted." : operation.action === "reject" ? "Reject this pending request with a short resolution note. No account data will be deleted." : "Mark only the request record completed. This does not delete or anonymize any account data."}`}</p>
      {state.success ? <><p role="status" className="mt-4 text-sm text-slate-700">{state.message}</p><div className="mt-6 flex justify-end"><Button ref={done} type="button" className="cursor-pointer" onClick={onClose}>Done</Button></div></> : <form noValidate className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget); startTransition(() => action(data)); }}>
        {operation.kind === "staff" ? <>
          <input type="hidden" name="staffId" value={operation.officer.id} />
          <Field label="Full name" htmlFor="staff-full-name" required error={state.fields?.fullName?.[0]}><TextInput id="staff-full-name" name="fullName" required maxLength={100} autoComplete="off" value={fullName} onChange={e => setFullName(e.target.value)} /></Field>
          <Field label="Work email" htmlFor="staff-work-email" required error={state.fields?.email?.[0]}><TextInput id="staff-work-email" name="email" required type="email" maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <p className="text-sm text-slate-600">Role: Claims Officer (read-only)</p>
        </> : <>
          <input type="hidden" name="requestId" value={operation.request.id} /><input type="hidden" name="action" value={operation.action} />
          {operation.action !== "process" ? <Field label="Resolution note" htmlFor="resolution-note" required error={state.fields?.note?.[0]}><TextArea id="resolution-note" name="note" required maxLength={2000} rows={3} className="resize-none" value={note} onChange={e => setNote(e.target.value)} /></Field> : null}
        </>}
        <label htmlFor="management-confirmed" className="flex items-start gap-3 text-sm leading-6 text-slate-700"><input id="management-confirmed" name="confirmed" type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} aria-invalid={state.fields?.confirmed ? true : undefined} aria-describedby={state.fields?.confirmed ? "management-confirmed-error" : undefined} className="mt-1 size-4 shrink-0 accent-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]" />{operation.kind === "staff" ? "I confirm these are authorized organization-managed account details." : "I confirm this request status change. No account data will be deleted."}</label>
        {state.fields?.confirmed ? <p id="management-confirmed-error" role="alert" className="text-sm text-rose-700">{state.fields.confirmed[0]}</p> : null}
        {state.message ? <p role="alert" className="text-sm text-rose-700">{state.message}</p> : null}
        {pending ? <p role="status" className="sr-only">Saving changes.</p> : null}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><Button ref={cancel} type="button" variant="secondary" disabled={pending} className="cursor-pointer" onClick={onClose}>Cancel</Button><Button type="submit" variant={operation.kind === "request" && operation.action === "reject" ? "danger" : "primary"} disabled={pending || !confirmed} aria-busy={pending} className="cursor-pointer">{pending ? "Saving…" : operation.kind === "staff" ? "Save changes" : title}</Button></div>
      </form>}
    </div>
  </div>;
}
