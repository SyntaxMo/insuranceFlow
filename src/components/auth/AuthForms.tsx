"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { loginAction, signupAction } from "@/app/(auth)/actions";
import {
  prepareSignupSubmission,
  type AuthFormState,
  type SignupInput,
} from "@/lib/auth/validation";
import { Alert, Button, Field, TextInput } from "@/components/ui/Forms";

const initialState: AuthFormState = {};

function SubmitButton({
  pending,
  label,
  pendingLabel = "Please wait…",
}: {
  pending: boolean;
  label: string;
  pendingLabel?: string;
}) {
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="email" error={state.fields?.email?.[0]}>
        <TextInput id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fields?.password?.[0]}>
        <TextInput id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <SubmitButton pending={pending} label="Sign in" />
      <p className="text-center text-sm text-slate-600">
        New customer?{" "}
        <Link className="font-semibold text-[var(--brand-teal)] hover:underline" href="/signup">
          Create an account
        </Link>
      </p>
    </form>
  );
}

const emptySignup: SignupInput = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initialState);
  const [values, setValues] = useState<SignupInput>(emptySignup);
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
  const [showServerState, setShowServerState] = useState(true);
  const submissionLocked = useRef(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      submissionLocked.current = false;
    }
    wasPending.current = pending;
  }, [pending]);

  function updateField(field: keyof SignupInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setLocalErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setShowServerState(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const decision = prepareSignupSubmission(
      values,
      submissionLocked.current || pending,
    );
    setLocalErrors(decision.fields);
    setShowServerState(false);
    if (!decision.shouldSubmit) {
      event.preventDefault();
      return;
    }

    // Close the gap before React exposes the pending action state.
    submissionLocked.current = true;
    setShowServerState(true);
  }

  function fieldError(field: keyof SignupInput): string | undefined {
    return (
      localErrors[field]?.[0] ||
      (showServerState ? state.fields?.[field]?.[0] : undefined)
    );
  }

  return (
    <form
      action={action}
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit}
    >
      <Field label="Full name" htmlFor="fullName" error={fieldError("fullName")}>
        <TextInput
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          value={values.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={fieldError("email")}>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
        />
      </Field>
      <Field label="Phone" htmlFor="phone" error={fieldError("phone")}>
        <TextInput
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          value={values.phone}
          onChange={(event) => updateField("phone", event.target.value)}
        />
      </Field>
      <Field label="Password" htmlFor="password" hint="Use at least 8 characters." error={fieldError("password")}>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={values.password}
          onChange={(event) => updateField("password", event.target.value)}
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={fieldError("confirmPassword")}>
        <TextInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={values.confirmPassword}
          onChange={(event) =>
            updateField("confirmPassword", event.target.value)
          }
        />
      </Field>
      {showServerState && state.message ? (
        <Alert tone={state.success ? "success" : "error"}>
          {state.message}
        </Alert>
      ) : null}
      <SubmitButton
        pending={pending}
        label="Create customer account"
        pendingLabel="Creating account..."
      />
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="font-semibold text-[var(--brand-teal)] hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}
