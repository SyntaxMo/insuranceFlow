"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, TextArea } from "@/components/ui/Forms";
import type { OfficerClaimAction } from "@/lib/claims/workflow";

type DialogConfig = {
  action: OfficerClaimAction;
  title: string;
  description: string;
  noteLabel?: string;
  noteRequired?: boolean;
  confirmLabel: string;
  danger?: boolean;
};

const CONFIGS: Record<Exclude<OfficerClaimAction, "start_review">, DialogConfig> = {
  return_to_new: {
    action: "return_to_new",
    title: "Return this claim to the New queue?",
    description: "Previous review activity will remain in the claim history.",
    confirmLabel: "Return to New",
  },
  request_more_info: {
    action: "request_more_info",
    title: "Request more information",
    description: "Tell the customer exactly what is needed to continue the review.",
    noteLabel: "Message to customer",
    noteRequired: true,
    confirmLabel: "Send request",
  },
  approve: {
    action: "approve",
    title: "Approve this claim?",
    description: "This records the Claims Officer's decision in the InsureFlow demonstration workflow.",
    noteLabel: "Decision note (optional)",
    confirmLabel: "Approve claim",
  },
  reject: {
    action: "reject",
    title: "Reject this claim?",
    description: "Provide a clear, customer-safe reason for this decision.",
    noteLabel: "Rejection reason",
    noteRequired: true,
    confirmLabel: "Reject claim",
    danger: true,
  },
  close: {
    action: "close",
    title: "Close this claim?",
    description: "Closed claims are read-only in this V1 demonstration.",
    noteLabel: "Closure note (optional)",
    confirmLabel: "Close claim",
  },
};

function ActionDialog({
  config,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  config: DialogConfig;
  onClose: () => void;
  onConfirm: (note: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (config.noteLabel ? inputRef.current : closeRef.current)?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [config.noteLabel, onClose, pending]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="claim-action-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="claim-action-title" className="text-xl font-semibold text-[var(--brand-navy)]">{config.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{config.description}</p></div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={pending} aria-label="Close dialog" className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-teal)]">×</button>
        </div>
        {config.noteLabel ? (
          <div className="mt-5"><label htmlFor="claim-action-note" className="mb-1.5 block text-sm font-medium text-slate-800">{config.noteLabel}</label><TextArea ref={inputRef} id="claim-action-note" rows={5} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} required={config.noteRequired} disabled={pending} /><p className="mt-1 text-right text-xs text-slate-400">{note.length}/1000</p></div>
        ) : null}
        {error ? <div className="mt-4"><Alert tone="error">{error}</Alert></div> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button><Button type="button" variant={config.danger ? "danger" : "primary"} onClick={() => onConfirm(note)} disabled={pending || Boolean(config.noteRequired && !note.trim())}>{pending ? "Updating…" : config.confirmLabel}</Button></div>
      </div>
    </div>
  );
}

export function ClaimOfficerActions({ claimId, status }: { claimId: string; status: string }) {
  const router = useRouter();
  const normalized = status.toUpperCase();
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: OfficerClaimAction, note: string | null = null) {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/claims/${claimId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const payload = await response.json() as { error?: string; emailDelivered?: boolean | null };
      if (!response.ok) {
        setError(payload.error || "We couldn't update this claim.");
        return;
      }
      if (payload.emailDelivered === false) setNotice("The claim was updated, but the customer email could not be delivered.");
      setDialog(null);
      router.refresh();
    } catch {
      setError("We couldn't update this claim. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const actions = normalized === "UNDER_REVIEW"
    ? [CONFIGS.request_more_info, CONFIGS.approve, CONFIGS.reject, CONFIGS.return_to_new]
    : normalized === "APPROVED" || normalized === "REJECTED"
      ? [CONFIGS.close]
      : [];

  return (
    <Card className="space-y-4">
      <div><h2 className="text-lg font-semibold text-[var(--brand-navy)]">Officer actions</h2><p className="mt-1 text-sm text-slate-600">Human decisions are recorded with the authenticated officer and timestamp.</p></div>
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {!dialog && error ? <Alert tone="error">{error}</Alert> : null}
      {normalized === "SUBMITTED" ? <Button type="button" onClick={() => run("start_review")} disabled={pending}>{pending ? "Starting review…" : "Start review"}</Button> : null}
      {actions.length > 0 ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions.map((config) => <Button key={config.action} type="button" variant={config.danger ? "danger" : config.action === "approve" ? "primary" : "secondary"} onClick={() => { setError(null); setDialog(config); }}>{config.confirmLabel}</Button>)}</div> : null}
      {normalized === "MORE_INFO_REQUIRED" ? <p className="text-sm text-slate-600">Waiting for the customer to submit the requested information.</p> : null}
      {normalized === "CLOSED" ? <p className="text-sm text-slate-600">This claim is closed and read-only.</p> : null}
      {dialog ? <ActionDialog config={dialog} pending={pending} error={error} onClose={() => { setDialog(null); setError(null); }} onConfirm={(note) => run(dialog.action, note)} /> : null}
    </Card>
  );
}
