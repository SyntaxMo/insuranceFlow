"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { getDemoPolicyQuote, issueDemoPolicy, type IssuePolicyState } from "@/app/dashboard/policies/new/actions";
import { CoverageAssistant } from "@/components/dashboard/CoverageAssistant";
import { VehicleMakeAutocomplete, VehicleModelAutocomplete } from "@/components/dashboard/VehicleAutocomplete";
import { Alert, Button, Card, Field, TextInput, buttonClassName } from "@/components/ui/Forms";
import { formatCoverageType, formatCurrency, formatDate } from "@/lib/format";
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
    <nav aria-label="Policy purchase progress">
      <div
        className="grid grid-cols-6 gap-1 sm:gap-1.5"
        role="progressbar"
        aria-label={`Step ${current} of 6: ${STEPS[current - 1]}`}
        aria-valuemin={1}
        aria-valuemax={6}
        aria-valuenow={current}
      >
        {STEPS.map((_, index) => <span key={index} aria-hidden="true" className={`h-1.5 rounded-full transition-colors ${index + 1 <= current ? "bg-[var(--brand-teal)]" : "bg-slate-200"}`} />)}
      </div>
      <div className="mt-3 flex min-w-0 items-start justify-between gap-4">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-teal)]">Step {current} of 6</p>
        <p className="min-w-0 text-right text-sm font-semibold leading-5 text-[var(--brand-navy)]">{STEPS[current - 1]}</p>
      </div>
    </nav>
  );
}

function PaymentButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "Issuing policy..." : "Complete simulated payment"}</Button>;
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><dt className="shrink-0 text-sm text-slate-500">{label}</dt><dd className="min-w-0 break-words font-medium text-slate-900 sm:text-right">{value}</dd></div>;
}

export function PolicyPurchaseWizard({ customer, requestId }: { customer: { fullName: string | null; email: string | null }; requestId: string }) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>({ make: "", model: "", year: String(new Date().getFullYear()), plateNumber: "", vin: "", estimatedVehicleValue: "" });
  const [coverage, setCoverage] = useState<DemoCoverage | null>(null);
  const [coverageValidationAttempted, setCoverageValidationAttempted] = useState(false);
  const [quoteView, setQuoteView] = useState<QuoteView | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const initialState: IssuePolicyState = { status: "idle" };
  const [issueState, issueAction] = useActionState(issueDemoPolicy, initialState);

  const update = (name: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setQuoteView(null);
    setConsentAccepted(false);
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
    if (quoting) return;
    if (!coverage) {
      setCoverageValidationAttempted(true);
      return;
    }
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
      <Card className="mx-auto max-w-3xl overflow-hidden p-0 text-center sm:p-0">
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-7"><StepIndicator current={6} /></div>
        <div className="px-5 py-7 sm:px-8 sm:py-9">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700 ring-1 ring-emerald-200" aria-hidden="true">✓</div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-teal)]">Policy issued</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">You&apos;re covered</h2>
        <p className="mt-2 text-slate-600">Your motor policy has been issued successfully.</p>
        {issueState.deliveryWarning ? <div className="mx-auto mt-5 max-w-xl text-left"><Alert tone="info">{issueState.deliveryWarning}</Alert></div> : null}
        <dl className="mx-auto mt-7 max-w-xl rounded-2xl bg-slate-50 px-4 py-2 text-left ring-1 ring-slate-200 sm:px-5">
          <SummaryRow label="Policy number" value={<strong className="text-[var(--brand-navy)]">{issueState.policy.policyNumber}</strong>} />
          <SummaryRow label="Vehicle" value={`${values.make} ${values.model} (${values.year})`} />
          <SummaryRow label="Coverage" value={formatCoverageType(issueState.policy.coverageLabel)} />
          <SummaryRow label="Policy period" value={`${formatDate(issueState.policy.startDate)} – ${formatDate(issueState.policy.endDate)}`} />
          <SummaryRow label="Annual premium" value={formatCurrency(issueState.policy.annualPremium)} />
          <SummaryRow label="Excess" value={formatCurrency(issueState.policy.excess)} />
        </dl>
        <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className={buttonClassName("secondary", "w-full sm:w-auto")}>Back to dashboard</Link>
          {issueState.policy.documentAvailable ? <a href={`/dashboard/policies/${issueState.policy.id}/document`} className={buttonClassName("secondary", "w-full sm:w-auto")} aria-label={`Download policy ${issueState.policy.policyNumber}`}>Download policy</a> : null}
          <Link href={`/dashboard/policies/${issueState.policy.id}`} className={buttonClassName("primary", "w-full sm:w-auto")}>View policy</Link>
        </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-4xl overflow-hidden p-0 sm:p-0">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-7"><StepIndicator current={step} /></div>
      <div className="px-5 py-6 sm:px-7 sm:py-8">
      {(message || issueState.message) ? <div className="mb-5"><Alert tone="error">{message || issueState.message}</Alert></div> : null}

      {step === 1 ? (
        <section aria-labelledby="vehicle-step-heading">
          <h2 id="vehicle-step-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Tell us about your vehicle</h2>
          <p className="mt-2 text-sm text-slate-600">Enter the vehicle details used for this demonstration quote. Nothing is saved yet.</p>
          <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
            <Field label="Make" htmlFor="make" error={fieldErrors.make}><VehicleMakeAutocomplete value={values.make} onChange={(value) => update("make", value)} /></Field>
            <Field label="Model" htmlFor="model" error={fieldErrors.model}><VehicleModelAutocomplete make={values.make} value={values.model} onChange={(value) => update("model", value)} /></Field>
            <Field label="Year" htmlFor="year" error={fieldErrors.year}><TextInput id="year" inputMode="numeric" value={values.year} onChange={(e) => update("year", e.target.value)} /></Field>
            <Field label="Plate number" htmlFor="plate" error={fieldErrors.plateNumber} hint="Enter the 5 or 6 digit Bahrain plate number."><TextInput id="plate" value={values.plateNumber} onChange={(e) => update("plateNumber", e.target.value)} placeholder="123456" inputMode="numeric" pattern="[0-9]{5,6}" maxLength={6} autoComplete="off" /></Field>
            <Field label="VIN (optional)" htmlFor="vin" error={fieldErrors.vin} hint="If entered, use the 17-character vehicle identification number."><TextInput id="vin" value={values.vin} onChange={(e) => update("vin", e.target.value)} placeholder="Optional" maxLength={20} /></Field>
            <Field label="Estimated vehicle value" htmlFor="vehicle-value" error={fieldErrors.estimatedVehicleValue} hint="BHD 1,000–250,000 for this demonstration."><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-medium text-slate-500">BHD</span><TextInput id="vehicle-value" className="pl-14" type="number" min="1000" max="250000" step="0.001" value={values.estimatedVehicleValue} onChange={(e) => update("estimatedVehicleValue", e.target.value)} /></div></Field>
          </div>
          <div className="mt-8 flex justify-end"><Button type="button" className="w-full sm:w-auto" onClick={continueVehicle}>Continue to coverage</Button></div>
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="coverage-step-heading">
          <h2 id="coverage-step-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Choose coverage</h2>
          <p className="mt-2 text-sm text-slate-600">These simplified options and limits are for the InsureFlow demonstration.</p>
          <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2">
            {([
              { id: "COMPREHENSIVE" as const, description: "Covers damage to your insured vehicle subject to the policy terms and conditions.", excess: 150, limit: Number(values.estimatedVehicleValue) },
              { id: "THIRD_PARTY" as const, description: "Covers third-party liability subject to the policy terms and conditions.", excess: 0, limit: 100000 },
            ]).map((option) => (
              <button key={option.id} type="button" onClick={() => { setCoverage(option.id); setCoverageValidationAttempted(false); setMessage(null); setConsentAccepted(false); }} className={`flex h-full min-w-0 flex-col rounded-2xl border p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] sm:p-6 ${coverage === option.id ? "border-[var(--brand-teal)] bg-teal-50/70 shadow-[0_16px_35px_-28px_rgba(13,148,136,0.8)] ring-1 ring-[var(--brand-teal)]" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"}`} aria-pressed={coverage === option.id} aria-label={`${formatCoverageType(option.id)} coverage${coverage === option.id ? ", selected" : ""}`}>
                <span className="flex w-full flex-wrap items-start justify-between gap-3">
                  <span className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">{formatCoverageType(option.id)}</span>
                  {coverage === option.id ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200"><span aria-hidden="true">✓</span> Selected</span> : null}
                </span>
                <span className="mt-2 block flex-1 text-sm leading-6 text-slate-600">{option.description}</span>
                <span className="mt-5 grid w-full grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-sm"><span><span className="block text-xs text-slate-500">Excess</span><strong className="mt-1 block text-slate-800">{formatCurrency(option.excess)}</strong></span><span><span className="block text-xs text-slate-500">Coverage limit</span><strong className="mt-1 block text-slate-800">{formatCurrency(option.limit)}</strong></span></span>
              </button>
            ))}
          </div>
          <CoverageAssistant
            vehicle={{
              make: values.make,
              model: values.model,
              year: Number(values.year),
              estimatedValue: Number(values.estimatedVehicleValue),
            }}
            selectedCoverage={coverage}
            onAccept={(recommendedCoverage) => {
              setCoverage(recommendedCoverage);
              setCoverageValidationAttempted(false);
              setMessage(null);
              setConsentAccepted(false);
            }}
          />
          {coverageValidationAttempted && !coverage ? <p role="alert" className="mt-3 text-sm text-rose-600">Choose a coverage option to continue.</p> : null}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setStep(1)}>Back</Button><Button type="button" className="w-full sm:w-auto" disabled={quoting} onClick={requestQuote}>{quoting ? "Preparing quote..." : "See your quote"}</Button></div>
        </section>
      ) : null}

      {step === 3 && quoteView ? (
        <section aria-labelledby="quote-step-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--brand-teal)]">Simulated quote</p>
          <h2 id="quote-step-heading" className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)]">Your annual quote</h2>
          <p className="mt-2 text-sm text-slate-600">This quote is generated for the InsureFlow demonstration experience.</p>
          <div data-slot="quote-summary" className="mt-6 grid items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)] sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(12rem,15rem)] md:gap-6">
            <dl className="min-w-0"><SummaryRow label="Vehicle" value={`${values.make} ${values.model} (${values.year})`} /><SummaryRow label="Plate" value={values.plateNumber} /><SummaryRow label="Coverage" value={formatCoverageType(quoteView.quote.coverageLabel)} /><SummaryRow label="Estimated vehicle value" value={formatCurrency(Number(values.estimatedVehicleValue))} /><SummaryRow label="Excess" value={formatCurrency(quoteView.quote.excess)} /><SummaryRow label="Coverage limit" value={formatCurrency(quoteView.quote.coverageLimit)} /><SummaryRow label="Policy term" value="12 months" /></dl>
            <aside aria-label="Annual premium summary" data-slot="premium-summary" className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white px-5 py-5 shadow-[0_14px_30px_-26px_rgba(13,148,136,0.7)] sm:px-6 md:px-5">
              <p className="text-sm font-semibold text-teal-800">Annual premium</p>
              <p className="mt-1.5 font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--brand-navy)] sm:text-4xl">{formatCurrency(quoteView.quote.annualPremium)}</p>
              <p className="mt-1.5 text-xs font-medium text-slate-500">For 12 months</p>
            </aside>
          </div>
          <details className="group mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3.5"><summary className="cursor-pointer font-semibold text-[var(--brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]">How was this calculated?</summary><div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600"><p className="leading-6">Your quote is based on the selected coverage, estimated vehicle value, and vehicle age.</p><dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Coverage</dt><dd className="mt-1 font-medium text-slate-800">{formatCoverageType(quoteView.quote.coverageLabel)}</dd></div><div><dt className="text-xs text-slate-500">Estimated vehicle value</dt><dd className="mt-1 font-medium text-slate-800">{formatCurrency(Number(values.estimatedVehicleValue))}</dd></div><div><dt className="text-xs text-slate-500">Vehicle age adjustment</dt><dd className="mt-1 font-medium text-slate-800">{quoteView.quote.adjustmentLabel}</dd></div><div><dt className="text-xs text-slate-500">Annual premium</dt><dd className="mt-1 font-medium text-slate-800">{formatCurrency(quoteView.quote.annualPremium)}</dd></div></dl><p className="mt-4 leading-6">The final premium is calculated using InsureFlow&apos;s simplified demonstration pricing rules.</p><p className="mt-2 text-xs leading-5 text-slate-500">These are demonstration pricing rules and are not real insurance underwriting rates.</p></div></details>
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setStep(2)}>Back</Button><Button type="button" className="w-full sm:w-auto" onClick={() => setStep(4)}>Review details</Button></div>
        </section>
      ) : null}

      {step === 4 && quoteView ? (
        <section aria-labelledby="review-step-heading">
          <h2 id="review-step-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Review your details</h2>
          <p className="mt-2 text-sm text-slate-600">Check the information below before continuing to the simulated payment.</p>
          <div className="mt-6 grid items-stretch gap-5 md:grid-cols-2">
            <div className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h3 className="font-semibold text-[var(--brand-navy)]">Customer</h3><dl className="mt-3"><SummaryRow label="Name" value={customer.fullName || "Customer"} /><SummaryRow label="Email" value={customer.email || "Not available"} /></dl></div>
            <div className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h3 className="font-semibold text-[var(--brand-navy)]">Vehicle</h3><dl className="mt-3"><SummaryRow label="Vehicle" value={`${values.make} ${values.model} (${values.year})`} /><SummaryRow label="Plate" value={values.plateNumber} />{values.vin ? <SummaryRow label="VIN" value={values.vin} /> : null}</dl></div>
            <div className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h3 className="font-semibold text-[var(--brand-navy)]">Coverage</h3><dl className="mt-3"><SummaryRow label="Type" value={formatCoverageType(quoteView.quote.coverageLabel)} /><SummaryRow label="Excess" value={formatCurrency(quoteView.quote.excess)} /><SummaryRow label="Limit" value={formatCurrency(quoteView.quote.coverageLimit)} /><SummaryRow label="Dates" value={`${formatDate(quoteView.startDate)} – ${formatDate(quoteView.endDate)}`} /></dl></div>
            <div className="flex h-full min-w-0 flex-col justify-between rounded-2xl border border-teal-100 bg-teal-50/50 p-5 sm:p-6 md:min-h-52"><div><h3 className="font-semibold text-[var(--brand-navy)]">Price</h3><p className="mt-5 text-sm text-slate-500">Annual premium</p><p className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--brand-navy)] sm:text-4xl">{formatCurrency(quoteView.quote.annualPremium)}</p></div><p className="mt-6 inline-flex self-start rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">12-month policy</p></div>
          </div>
          <div data-slot="policy-consent" className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="relative mt-0.5 block size-5 shrink-0">
                <input id="purchase-consent" type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} className="peer absolute inset-0 z-10 size-5 cursor-pointer opacity-0" />
                <span data-testid="purchase-consent-control" aria-hidden="true" className={`pointer-events-none flex size-5 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brand-teal)] peer-focus-visible:ring-offset-2 ${consentAccepted ? "border-[var(--brand-teal)] bg-[var(--brand-teal)] text-white" : "border-slate-400 bg-white text-transparent"}`}>
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg>
                </span>
              </span>
              <div className="min-w-0">
                <label htmlFor="purchase-consent" className="block cursor-pointer text-sm leading-6 text-slate-700">I confirm that the information provided is correct and I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand-teal)] underline underline-offset-2 hover:text-[var(--brand-teal-deep)]">Terms &amp; Conditions</Link>. I understand that InsureFlow is a demonstration platform and that this quote, payment, and policy are simulated.</label>
                <nav aria-label="Purchase information" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium"><Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-slate-600 underline underline-offset-2 hover:text-[var(--brand-navy)]">Privacy Policy</Link><Link href="/disclaimer" target="_blank" rel="noopener noreferrer" className="text-slate-600 underline underline-offset-2 hover:text-[var(--brand-navy)]">Insurance &amp; Demo Disclaimer</Link></nav>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setStep(3)}>Back</Button><Button type="button" className="w-full sm:w-auto" disabled={!consentAccepted} onClick={() => setStep(5)}>Continue to payment</Button></div>
        </section>
      ) : null}

      {step === 5 && quoteView && coverage ? (
        <section aria-labelledby="payment-step-heading">
          <h2 id="payment-step-heading" className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">Payment</h2>
          <p className="mt-2 text-sm text-slate-600">Complete the demonstration payment to issue this policy to your account.</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">Annual premium</p><p className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--brand-navy)] sm:text-4xl">{formatCurrency(quoteView.quote.annualPremium)}</p></div><p className="text-sm font-medium text-slate-500">12-month policy</p></div><div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">This is a simulated payment for the InsureFlow portfolio demonstration. No real payment will be processed.</div><dl className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Payment method</dt><dd className="mt-1 font-semibold text-[var(--brand-navy)]">Demo payment</dd></dl></div>
          <form action={issueAction} className="mt-7">
            {Object.entries({ ...values, coverage, requestId, consentAccepted: consentAccepted ? "true" : "false" }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setStep(4)}>Back</Button><PaymentButton /></div>
          </form>
        </section>
      ) : null}
      </div>
    </Card>
  );
}
