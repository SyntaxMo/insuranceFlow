"use client";

import { useActionState, useEffect, useState } from "react";
import {
  lookupExistingPolicyAction,
  sendPolicyVerificationCodeAction,
  type PolicyLookupState,
  type SendPolicyCodeState,
} from "@/app/dashboard/policies/link/actions";
import { statusLabel, statusTone } from "@/lib/format";
import { Alert, Button, Card, Field, TextInput } from "@/components/ui/Forms";

const initialState: PolicyLookupState = {};
const initialSendState: SendPolicyCodeState = {};

function CooldownSubmitButton({
  initialSeconds,
  pending,
  resend = false,
}: {
  initialSeconds: number;
  pending: boolean;
  resend?: boolean;
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = window.setTimeout(
      () => setSecondsRemaining((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [secondsRemaining]);

  return (
    <Button
      type="submit"
      variant={resend ? "ghost" : "primary"}
      className={resend ? undefined : "mt-5 w-full sm:w-auto"}
      disabled={pending || secondsRemaining > 0}
    >
      {pending
        ? resend
          ? "Sending…"
          : "Sending code…"
        : secondsRemaining > 0
          ? resend
            ? `Resend code in ${secondsRemaining}s`
            : `Try again in ${secondsRemaining}s`
          : resend
            ? "Resend code"
            : "Send verification code"}
    </Button>
  );
}

function VerificationCodeStep({
  policyNumber,
  email,
  initialMaskedEmail,
}: {
  policyNumber: string;
  email: string;
  initialMaskedEmail: string;
}) {
  const [state, action, pending] = useActionState(
    sendPolicyVerificationCodeAction,
    initialSendState,
  );
  const cooldownKey = state.cooldownToken || 0;
  const cooldownSeconds = state.cooldownSeconds || 0;

  return (
    <form action={action} className="mt-6 border-t border-slate-100 pt-6">
      <input type="hidden" name="policyNumber" value={policyNumber} />
      <input type="hidden" name="email" value={email} />

      {!state.sent ? (
        <>
          <p className="text-sm text-slate-500">Verification code will be sent to:</p>
          <p className="mt-1 font-semibold text-[var(--brand-navy)]">{initialMaskedEmail}</p>
          {state.message ? <div className="mt-4"><Alert tone="error">{state.message}</Alert></div> : null}
          <CooldownSubmitButton
            key={cooldownKey}
            initialSeconds={cooldownSeconds}
            pending={pending}
          />
        </>
      ) : (
        <div className="space-y-5">
          <Alert tone="success">
            <span className="font-semibold">Verification code sent</span>
            <span className="mt-1 block">We sent a code to {state.maskedEmail}.</span>
          </Alert>

          <Field
            label="Verification code"
            htmlFor="verificationCode"
            hint="Enter the 6-digit code from the email."
          >
            <TextInput
              id="verificationCode"
              name="verificationCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              className="max-w-52 text-center text-xl font-semibold tracking-[0.35em]"
            />
          </Field>

          {state.message ? <Alert tone="error">{state.message}</Alert> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" disabled className="sm:min-w-32">
              Verify code
            </Button>
            <CooldownSubmitButton
              key={cooldownKey}
              initialSeconds={cooldownSeconds}
              pending={pending}
              resend
            />
          </div>
        </div>
      )}
    </form>
  );
}

export function LinkPolicyForm() {
  const [state, action, pending] = useActionState(
    lookupExistingPolicyAction,
    initialState,
  );

  return (
    <div className="space-y-6">
      <Card>
        <form action={action} className="space-y-5" noValidate>
          <Field
            label="Policy number"
            htmlFor="policyNumber"
            error={state.fields?.policyNumber?.[0]}
          >
            <TextInput
              id="policyNumber"
              name="policyNumber"
              autoComplete="off"
              placeholder="For example, POL-2026-0101"
              required
            />
          </Field>
          <Field
            label="Registered email"
            htmlFor="email"
            error={state.fields?.email?.[0]}
          >
            <TextInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Email held on the policy"
              required
            />
          </Field>
          {state.message ? <Alert tone="error">{state.message}</Alert> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Checking policy…" : "Find policy"}
          </Button>
        </form>
      </Card>

      {state.match ? (
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className={`border-b px-5 py-4 sm:px-6 ${state.match.isExpired ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className={`text-sm font-semibold ${state.match.isExpired ? "text-amber-900" : "text-emerald-900"}`}>
              {state.match.isExpired ? "Policy found — coverage expired" : "Policy found"}
            </p>
            {state.match.isExpired ? <p className="mt-1 text-sm text-amber-800">This policy is not active coverage.</p> : null}
          </div>
          <div className="px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">
                  {state.match.vehicle.make} {state.match.vehicle.model} {state.match.vehicle.year}
                </h2>
                <p className="mt-1 text-slate-600">{state.match.coverageType}</p>
                <p className="mt-3 text-sm font-medium text-slate-700">Policy {state.match.maskedPolicyNumber}</p>
              </div>
              <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(state.match.status)}`}>
                {statusLabel(state.match.status)}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 border-y border-slate-100 py-5 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Policy starts</dt><dd className="mt-1 font-medium text-slate-800">{new Date(state.match.startDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</dd></div>
              <div><dt className="text-slate-500">Policy ends</dt><dd className="mt-1 font-medium text-slate-800">{new Date(state.match.endDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</dd></div>
            </dl>

            {state.lookup ? (
              <VerificationCodeStep
                policyNumber={state.lookup.policyNumber}
                email={state.lookup.email}
                initialMaskedEmail={state.match.maskedEmail}
              />
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
