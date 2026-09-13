"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { getDemoPolicyQuote, issueDemoPolicy, type IssuePolicyState } from "@/app/dashboard/policies/new/actions";
import { Alert, Button, Card, Field, TextInput, buttonClassName } from "@/components/ui/Forms";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DemoCoverage, DemoQuote } from "@/lib/policies/quote";
import { flattenPurchaseErrors, vehiclePurchaseSchema } from "@/lib/policies/purchase";

const STEPS = ["Vehicle details", "Coverage", "Your quote", "Review", "Payment", "Policy issued"];

type FormValues = {
  make: string;
  model: string;
  year: string;
  plateNumber: string;
  vin: string;
  estimatedVehicleValue: string;
};

type QuoteView = { quote: DemoQuote; startDate: string; endDate: string };

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Policy purchase progress" className="mb-8">
      <div className="grid grid-cols-6 gap-1.5" aria-hidden="true">
        {STEPS.map((_, index) => <span key={index} className={`h-1.5 rounded-full ${index + 1 <= current ? "bg-[var(--brand-teal)]" : "bg-slate-200"}`} />)}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-teal)]">Step {current} of 6</p>
        <p className="text-sm font-medium text-[var(--brand-navy)]">{STEPS[current - 1]}</p>
      </div>
    </nav>
  );
}

function PaymentButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "Issuing policy..." : "Complete simulated payment"}</Button>;
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"><dt className="text-sm text-slate-500">{label}</dt><dd className="font-medium text-slate-900 sm:text-right">{value}</dd></div>;
}

export function PolicyPurchaseWizard({ customer, requestId }: { customer: { fullName: string | null; email: string | null }; requestId: string }) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>({ make: "", model: "", year: String(new Date().getFullYear()), plateNumber: "", vin: "", estimatedVehicleValue: "" });
  const [coverage, setCoverage] = useState<DemoCoverage | null>(null);
  const [quoteView, setQuoteView] = useState<QuoteView | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const initialState: IssuePolicyState = { status: "idle" };
  const [issueState, issueAction] = useActionState(issueDemoPolicy, initialState);

  const update = (name: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setQuoteView(null);
  };

  const continueVehicle = () => {
    const parsed = vehiclePurchaseSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(flattenPurchaseErrors(parsed.error));
      return;
    }
    setValues({ ...values, ...parsed.data, year: String(parsed.data.year), estimatedVehicleValue: String(parsed.data.estimatedVehicleValue) });
    setFieldErrors({});
    setStep(2);
  };

  const requestQuote = async () => {
    if (!coverage || quoting) return;
    setQuoting(true);
    setMessage(null);
    try {
      const result = await getDemoPolicyQuote({ ...values, coverage });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        return;
      }
      setQuoteView({ quote: result.quote, startDate: result.startDate, endDate: result.endDate });
      setStep(3);
    } catch {
      setMessage("We couldn't prepare the quote right now. Please try again.");
    } finally {
      setQuoting(false);
    }
  };

  if (issueState.status === "success" && issueState.policy) {
    return (
      <Card className="mx-auto max-w-3xl text-center">
        <StepIndicator current={6} />
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700 ring-1 ring-emerald-200" aria-hidden="true">✓</div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-teal)]">Policy issued</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">You&apos;re covered</h2>
        <p className="mt-2 text-slate-600">Your motor policy has been issued successfully.</p>
        <dl className="mx-auto mt-7 max-w-xl rounded-2xl bg-slate-50 px-5 py-2 text-left ring-1 ring-slate-200">
          <SummaryRow label="Policy number" value={issueState.policy.policyNumber} />
          <SummaryRow label="Vehicle" value={`${values.make} ${values.model} (${values.year})`} />
          <SummaryRow label="Coverage" value={issueState.policy.coverageLabel} />
          <SummaryRow label="Policy period" value={`${formatDate(issueState.policy.startDate)} – ${formatDate(issueState.policy.endDate)}`} />
          <SummaryRow label="Annual premium" value={formatCurrency(issueState.policy.annualPremium)} />
          <SummaryRow label="Excess" value={formatCurrency(issueState.policy.excess)} />
        </dl>
        <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className={buttonClassName("secondary")}>Back to dashboard</Link>
          <Link href={`/dashboard/policies/${issueState.policy.id}`} className={buttonClassName("primary")}>View policy</Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <StepIndicator current={step} />
      {(message || issueState.message) ? <div className="mb-5"><Alert tone="error">{message || issueState.message}</Alert></div> : null}

      {step === 1 ? (
        <section aria-labelledby="vehicle-step-heading">
          <h2 id="vehicle-step-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Tell us about your vehicle</h2>
          <p className="mt-2 text-sm text-slate-600">Enter the vehicle details used for this demonstration quote. Nothing is saved yet.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Make" htmlFor="make" error={fieldErrors.make}><TextInput id="make" value={values.make} onChange={(e) => update("make", e.target.value)} placeholder="Toyota" maxLength={60} /></Field>
            <Field label="Model" htmlFor="model" error={fieldErrors.model}><TextInput id="model" value={values.model} onChange={(e) => update("model", e.target.value)} placeholder="Corolla" maxLength={60} /></Field>
            <Field label="Year" htmlFor="year" error={fieldErrors.year}><TextInput id="year" inputMode="numeric" value={values.year} onChange={(e) => update("year", e.target.value)} /></Field>
            <Field label="Plate number" htmlFor="plate" error={fieldErrors.plateNumber} hint="Enter the 5 or 6 digit Bahrain plate number."><TextInput id="plate" value={values.plateNumber} onChange={(e) => update("plateNumber", e.target.value)} placeholder="123456" inputMode="numeric" pattern="[0-9]{5,6}" maxLength={6} autoComplete="off" /></Field>
            <Field label="VIN (optional)" htmlFor="vin" error={fieldErrors.vin} hint="If entered, use the 17-character vehicle identification number."><TextInput id="vin" value={values.vin} onChange={(e) => update("vin", e.target.value)} placeholder="Optional" maxLength={20} /></Field>
            <Field label="Estimated vehicle value" htmlFor="vehicle-value" error={fieldErrors.estimatedVehicleValue} hint="BHD 1,000–250,000 for this demonstration."><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-medium text-slate-500">BHD</span><TextInput id="vehicle-value" className="pl-14" type="number" min="1000" max="250000" step="0.001" value={values.estimatedVehicleValue} onChange={(e) => update("estimatedVehicleValue", e.target.value)} /></div></Field>
          </div>
          <div className="mt-7 flex justify-end"><Button type="button" onClick={continueVehicle}>Continue to coverage</Button></div>
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="coverage-step-heading">
          <h2 id="coverage-step-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Choose coverage</h2>
          <p className="mt-2 text-sm text-slate-600">These simplified options and limits are for the InsureFlow demonstration.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {([
              { id: "COMPREHENSIVE" as const, name: "Comprehensive", description: "Covers damage to your insured vehicle subject to the policy terms and conditions.", excess: 150, limit: Number(values.estimatedVehicleValue) },
              { id: "THIRD_PARTY" as const, name: "Third Party", description: "Covers third-party liability subject to the policy terms and conditions.", excess: 0, limit: 100000 },
            ]).map((option) => (
              <button key={option.id} type="button" onClick={() => { setCoverage(option.id); setMessage(null); }} className={`rounded-2xl border p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${coverage === option.id ? "border-[var(--brand-teal)] bg-teal-50/60 ring-1 ring-[var(--brand-teal)]" : "border-slate-200 bg-white hover:border-slate-300"}`} aria-pressed={coverage === option.id}>
                <span className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">{option.name}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">{option.description}</span>
                <span className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm"><span><span className="block text-xs text-slate-500">Excess</span><strong className="mt-1 block text-slate-800">{formatCurrency(option.excess)}</strong></span><span><span className="block text-xs text-slate-500">Coverage limit</span><strong className="mt-1 block text-slate-800">{formatCurrency(option.limit)}</strong></span></span>
              </button>
            ))}
          </div>
          {!coverage ? <p className="mt-3 text-sm text-rose-600">Choose a coverage option to continue.</p> : null}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button><Button type="button" disabled={!coverage || quoting} onClick={requestQuote}>{quoting ? "Preparing quote..." : "See your quote"}</Button></div>
        </section>
      ) : null}

      {step === 3 && quoteView ? (
        <section aria-labelledby="quote-step-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--brand-teal)]">Simulated quote</p>
          <h2 id="quote-step-heading" className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">Your annual quote</h2>
          <p className="mt-2 text-sm text-slate-600">This quote is generated for the InsureFlow demonstration experience.</p>
          <div className="mt-6 grid gap-5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 sm:grid-cols-[1fr_auto] sm:p-6">
            <dl><SummaryRow label="Vehicle" value={`${values.make} ${values.model} (${values.year})`} /><SummaryRow label="Plate" value={values.plateNumber} /><SummaryRow label="Coverage" value={quoteView.quote.coverageLabel} /><SummaryRow label="Estimated vehicle value" value={formatCurrency(Number(values.estimatedVehicleValue))} /><SummaryRow label="Excess" value={formatCurrency(quoteView.quote.excess)} /><SummaryRow label="Coverage limit" value={formatCurrency(quoteView.quote.coverageLimit)} /><SummaryRow label="Policy term" value="12 months" /></dl>
            <div className="rounded-2xl bg-[var(--brand-navy)] p-5 text-white sm:min-w-56"><p className="text-sm text-slate-300">Annual premium</p><p className="mt-2 font-[family-name:var(--font-display)] text-3xl">{formatCurrency(quoteView.quote.annualPremium)}</p></div>
          </div>
          <details className="mt-5 rounded-xl border border-slate-200 px-4 py-3"><summary className="cursor-pointer font-medium text-[var(--brand-navy)]">How was this calculated?</summary><div className="mt-3 space-y-1 text-sm text-slate-600"><p>Coverage: {quoteView.quote.coverageLabel}</p><p>Vehicle value: {formatCurrency(Number(values.estimatedVehicleValue))}</p><p>Vehicle age at quote: {quoteView.quote.vehicleAge} years</p><p>Adjustment: {quoteView.quote.adjustmentLabel}</p><p>The final demo premium is capped by the published demonstration rules.</p></div></details>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" onClick={() => setStep(2)}>Back</Button><Button type="button" onClick={() => setStep(4)}>Review details</Button></div>
        </section>
      ) : null}

      {step === 4 && quoteView ? (
        <section aria-labelledby="review-step-heading">
          <h2 id="review-step-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Review your details</h2>
          <p className="mt-2 text-sm text-slate-600">By continuing, you confirm that the information entered for this demonstration is correct.</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold text-[var(--brand-navy)]">Customer</h3><dl className="mt-3"><SummaryRow label="Name" value={customer.fullName || "Customer"} /><SummaryRow label="Email" value={customer.email || "Not available"} /></dl></div>
            <div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold text-[var(--brand-navy)]">Vehicle</h3><dl className="mt-3"><SummaryRow label="Vehicle" value={`${values.make} ${values.model} (${values.year})`} /><SummaryRow label="Plate" value={values.plateNumber} />{values.vin ? <SummaryRow label="VIN" value={values.vin} /> : null}</dl></div>
            <div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold text-[var(--brand-navy)]">Coverage</h3><dl className="mt-3"><SummaryRow label="Type" value={quoteView.quote.coverageLabel} /><SummaryRow label="Excess" value={formatCurrency(quoteView.quote.excess)} /><SummaryRow label="Limit" value={formatCurrency(quoteView.quote.coverageLimit)} /><SummaryRow label="Dates" value={`${formatDate(quoteView.startDate)} – ${formatDate(quoteView.endDate)}`} /></dl></div>
            <div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold text-[var(--brand-navy)]">Price</h3><p className="mt-4 text-sm text-slate-500">Annual premium</p><p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">{formatCurrency(quoteView.quote.annualPremium)}</p></div>
          </div>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" onClick={() => setStep(3)}>Back</Button><Button type="button" onClick={() => setStep(5)}>Continue to payment</Button></div>
        </section>
      ) : null}

      {step === 5 && quoteView && coverage ? (
        <section aria-labelledby="payment-step-heading">
          <h2 id="payment-step-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Payment</h2>
          <div className="mt-6 rounded-2xl border border-slate-200 p-5 sm:p-6"><p className="text-sm text-slate-500">Annual premium</p><p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">{formatCurrency(quoteView.quote.annualPremium)}</p><div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">This is a simulated payment for the InsureFlow portfolio demonstration. No real payment will be processed.</div><p className="mt-5 text-sm font-medium text-slate-700">Payment method: Demo payment</p></div>
          <form action={issueAction} className="mt-7">
            {Object.entries({ ...values, coverage, requestId }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" onClick={() => setStep(4)}>Back</Button><PaymentButton /></div>
          </form>
        </section>
      ) : null}
    </Card>
  );
}
