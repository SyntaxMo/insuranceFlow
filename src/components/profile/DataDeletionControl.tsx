"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { cancelDataDeletionRequestAction, submitDataDeletionRequestAction } from "@/app/dashboard/profile/deletion-actions";
import { Button, Field, TextArea } from "@/components/ui/Forms";
import { isolateDialogBackground, preserveDialogFocus, trapDialogTab } from "@/lib/accessibility/focus";
import type { DataDeletionActionState, DataDeletionRequest } from "@/lib/privacy/types";
import { formatDate } from "@/lib/format";

const labels = { PENDING: "Pending", PROCESSING: "Processing", COMPLETED: "Completed", REJECTED: "Rejected", CANCELLED: "Cancelled" };

export function DataDeletionControl({ request, unavailable = false }: { request: DataDeletionRequest | null; unavailable?: boolean }) {
  const [change, setChange] = useState<{ source: typeof request; value: DataDeletionRequest } | null>(null);
  const current = change?.source === request ? change.value : request;
  const [dialog, setDialog] = useState<{ mode: "request" | "cancel"; request: typeof request } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  function close(result?: DataDeletionRequest) {
    if (result) setChange({ source: request, value: result });
    setDialog(null);
    window.setTimeout(() => triggerRef.current?.focus({ preventScroll: true }), 0);
  }
  if (unavailable) return <p role="status" className="mt-5 text-sm text-slate-600">Data deletion request status is temporarily unavailable. Please try again later.</p>;
  return <>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
      <div>
        <p className="text-sm font-medium text-[var(--brand-navy)]">{current ? "Data deletion request" : "Data deletion"}</p>
        {current ? <><p className="mt-1 text-sm text-slate-600">{labels[current.status]}</p><p className="mt-1 text-sm text-slate-600">Submitted {formatDate(current.createdAt)}</p></> : <p className="mt-1 text-sm text-slate-600">You can request deletion of your InsureFlow account data. Requests are reviewed before processing.</p>}
        {current?.status === "PENDING" ? <><p className="mt-2 text-sm leading-6 text-slate-600">Your request has been submitted for review. Requests in this demonstration are typically reviewed within 7–14 days.</p><p className="mt-1 text-sm leading-6 text-slate-600">You can cancel your request while it is still pending. Once processing begins, it can no longer be cancelled.</p></> : null}
        {current?.status === "PROCESSING" ? <p className="mt-2 text-sm leading-6 text-slate-600">Your deletion request is being processed and can no longer be cancelled.</p> : null}
        {current?.status === "COMPLETED" ? <p className="mt-2 text-sm leading-6 text-slate-600">The request was marked completed by an administrator. This does not confirm that account data was erased.</p> : null}
      </div>
      {current?.status !== "PROCESSING" ? <Button ref={triggerRef} type="button" variant="secondary" className="cursor-pointer border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDialog({ mode: current?.status === "PENDING" ? "cancel" : "request", request: current })}>
        {current?.status === "PENDING" ? "Cancel request" : "Request data deletion"}
      </Button> : null}
    </div>
    {dialog ? <DeletionDialog mode={dialog.mode} request={dialog.request} onClose={close} /> : null}
  </>;
}

function DeletionDialog({ mode, request, onClose }: { mode: "request" | "cancel"; request: DataDeletionRequest | null; onClose: (result?: DataDeletionRequest) => void }) {
  const [state, action, pending] = useActionState<DataDeletionActionState, FormData>(mode === "request" ? submitDataDeletionRequestAction : cancelDataDeletionRequestAction, {});
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const completed = Boolean(state.outcome);
  useEffect(() => isolateDialogBackground(dialogRef.current), []);
  useEffect(() => { (completed ? doneRef.current : mode === "cancel" ? keepRef.current : reasonRef.current)?.focus(); }, [completed, mode]);
  useEffect(() => {
    if (state.fields) dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  useEffect(() => {
    preserveDialogFocus(dialogRef.current);
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) { event.preventDefault(); onClose(state.request); return; }
      trapDialogTab(event, dialogRef.current);
    }
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [onClose, pending, state.request]);
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(state.request); }}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="deletion-title" aria-describedby="deletion-description" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
      <h2 id="deletion-title" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">{completed ? state.outcome === "received" ? "Request received" : "Request cancelled" : mode === "cancel" ? "Cancel data deletion request?" : "Request data deletion"}</h2>
      {completed ? <div role="status" aria-live="polite">
        <p id="deletion-description" className="mt-2 text-sm leading-6 text-slate-600">{state.outcome === "received" ? "Your data deletion request has been recorded for review." : "Your pending data deletion request has been cancelled."}</p>
        {state.outcome === "received" ? <p className="mt-3 text-sm leading-6 text-slate-600">Your account and existing records remain available while the request is pending.</p> : null}
        {state.emailSent === false ? <p className="mt-3 text-sm leading-6 text-slate-600">Your request was recorded, but we could not send the confirmation email. You can check its status in Settings.</p> : null}
        <div className="mt-6 flex justify-end"><Button ref={doneRef} type="button" className="cursor-pointer" onClick={() => onClose(state.request)}>Done</Button></div>
      </div> : <>
        <p id="deletion-description" className="mt-2 text-sm leading-6 text-slate-600">{mode === "cancel" ? "Your deletion request will be withdrawn and your account will remain active." : "You can request deletion of your InsureFlow account data. Some records may be retained for security, historical workflow integrity, or system maintenance."}</p>
        {mode === "request" ? <>
          <p className="mt-3 text-sm leading-6 text-slate-600">This feature simulates a privacy request workflow and does not represent a real statutory deletion process.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600"><li>Submitting a request does not immediately remove your account, policies, or claims.</li><li>Audit and history records are not automatically deleted.</li><li>Your request is recorded for review and may later be marked completed or rejected during administrator maintenance.</li></ul>
        </> : null}
        <form onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          // Preserve both the optional reason and acknowledgement on rejected submissions.
          startTransition(() => action(data));
        }} className="mt-5">
          {mode === "request" ? <>
            <Field label="Reason (optional)" htmlFor="deletion-reason" hint="Use demonstration information only; do not include sensitive details." error={state.fields?.reason?.[0]}>
              <TextArea ref={reasonRef} id="deletion-reason" name="reason" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="resize-none" rows={3} />
            </Field>
            <div className="mt-4"><label className="flex items-start gap-3 text-sm leading-6 text-slate-700" htmlFor="deletion-acknowledged"><input id="deletion-acknowledged" name="acknowledged" type="checkbox" required checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} aria-invalid={state.fields?.acknowledged ? true : undefined} aria-describedby={state.fields?.acknowledged ? "deletion-acknowledged-error" : undefined} className="mt-1 size-4 shrink-0 accent-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]" />I understand this submits a deletion request and does not immediately delete my account or records.</label>
              {state.fields?.acknowledged ? <p id="deletion-acknowledged-error" role="alert" className="mt-1 text-sm text-rose-700">{state.fields.acknowledged[0]}</p> : null}
            </div>
          </> : <><input type="hidden" name="requestId" value={request?.id ?? ""} /><input type="hidden" name="confirmed" value="on" /></>}
          {state.message ? <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.message}</p> : null}
          {pending ? <p role="status" className="sr-only">{mode === "request" ? "Recording your request." : "Cancelling your request."}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button ref={keepRef} type="button" variant="secondary" disabled={pending} className="cursor-pointer" onClick={() => onClose()}>{mode === "request" ? "Cancel" : "Keep request"}</Button>
            <Button type="submit" variant={mode === "cancel" ? "danger" : "primary"} disabled={pending || (mode === "request" && !acknowledged)} aria-busy={pending} className="cursor-pointer">{pending ? "Saving…" : mode === "request" ? "Submit request" : "Cancel request"}</Button>
          </div>
        </form>
      </>}
    </div>
  </div>;
}
