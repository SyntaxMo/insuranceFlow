"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { requestPasswordReset, resetPassword } from "@/app/(auth)/recovery-actions";
import { recoveryEmailSchema, recoveryPasswordSchema, type AuthFormState } from "@/lib/auth/validation";
import { Alert, Button, Field, TextInput } from "@/components/ui/Forms";

const linkClass = "inline-block rounded text-sm font-semibold text-[var(--brand-teal)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {} as AuthFormState);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    const parsed = recoveryEmailSchema.safeParse({ email });
    if (!parsed.success) {
      event.preventDefault();
      setError(parsed.error.flatten().fieldErrors.email?.[0]);
      input.current?.focus();
    }
  }
  return <div className="space-y-5">
    <p className="sr-only" role="status" aria-live="polite">{pending ? "Sending reset link…" : ""}</p>
    {state.success ? <Alert tone="success">{state.message}</Alert> : <form action={action} onSubmit={submit} noValidate className="space-y-5">
      <Field label="Email" htmlFor="recovery-email" error={error ?? state.fields?.email?.[0]}>
        <TextInput ref={input} id="recovery-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(undefined); }} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Send reset link"}</Button>
    </form>}
    <Link href="/login" className={linkClass}>Back to sign in</Link>
  </div>;
}

export function ResetPasswordForm({ recoveryValid = true }: { recoveryValid?: boolean }) {
  const [state, action, pending] = useActionState(resetPassword, {} as AuthFormState);
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [localFields, setLocalFields] = useState<Record<string, string[]>>({});
  const [showServer, setShowServer] = useState(true);
  const form = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.success) success.current?.focus();
    else if (state.fields) form.current?.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus();
  }, [state]);
  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending) { event.preventDefault(); return; }
    const parsed = recoveryPasswordSchema.safeParse(values);
    if (!parsed.success) {
      event.preventDefault();
      const fields = parsed.error.flatten().fieldErrors;
      setLocalFields(fields);
      setShowServer(false);
      form.current?.querySelector<HTMLInputElement>(`[name="${fields.password ? "password" : "confirmPassword"}"]`)?.focus();
    } else { setLocalFields({}); setShowServer(true); }
  }
  function error(name: keyof typeof values) { return localFields[name]?.[0] ?? (showServer ? state.fields?.[name]?.[0] : undefined); }
  if (state.success) return <div className="space-y-5">
    <h2 ref={success} tabIndex={-1} className="text-xl font-semibold text-[var(--brand-navy)]">Password updated</h2>
    <p role="status" className="text-sm text-slate-600">You can now sign in with your new password.</p>
    <Link href="/login" className={linkClass}>Back to sign in</Link>
  </div>;
  // Keep this component mounted when cookie consumption re-renders the page.
  // Completed action state wins over the now-consumed recovery authorization.
  if (!recoveryValid) return <div className="space-y-5">
    <Alert>This password reset session is no longer active. If you still need to change your password, request a new reset link.</Alert>
    <Link href="/forgot-password" className={linkClass}>Request a new reset link</Link>
    <div><Link href="/login" className={linkClass}>Back to sign in</Link></div>
  </div>;
  return <div className="space-y-5">
    <form ref={form} action={action} onSubmit={submit} noValidate className="space-y-5">
      <p className="sr-only" role="status" aria-live="polite">{pending ? "Updating password…" : ""}</p>
      {(["password", "confirmPassword"] as const).map((name) => <Field key={name} label={name === "password" ? "New password" : "Confirm new password"} htmlFor={`reset-${name}`} error={error(name)} hint={name === "password" ? "Use at least 8 characters." : undefined}>
        <TextInput id={`reset-${name}`} name={name} type="password" autoComplete="new-password" required aria-invalid={Boolean(error(name))} value={values[name]} onChange={(event) => { setValues((current) => ({ ...current, [name]: event.target.value })); setLocalFields({}); setShowServer(false); }} />
      </Field>)}
      {showServer && state.message ? <Alert>{state.message}</Alert> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Updating…" : "Update password"}</Button>
    </form>
    <Link href="/forgot-password" className={linkClass}>Request a new reset link</Link>
    <div><Link href="/login" className={linkClass}>Back to sign in</Link></div>
  </div>;
}
