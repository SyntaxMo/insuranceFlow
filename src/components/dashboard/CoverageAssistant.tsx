"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, TextArea } from "@/components/ui/Forms";
import { formatCoverageType, formatCurrency, formatVehicleName } from "@/lib/format";
import { COVERAGE_ASSISTANT_QUESTIONS } from "@/lib/coverage-assistant/questions";
import {
  coverageRecommendationSchema,
  type CoveragePreferences,
  type CoverageRecommendation,
} from "@/lib/coverage-assistant/schema";
import type { DemoCoverage } from "@/lib/policies/quote";

const LOADING_MESSAGES = [
  "Reviewing your priorities",
  "Comparing coverage options",
  "Considering your vehicle",
  "Preparing your recommendation",
] as const;

type AssistantStage = "questions" | "note" | "loading" | "result" | "error";

type VehicleContext = {
  make: string;
  model: string;
  year: number;
  estimatedValue: number;
};

export function CoverageAssistant({
  vehicle,
  selectedCoverage,
  onAccept,
}: {
  vehicle: VehicleContext;
  selectedCoverage: DemoCoverage | null;
  onAccept: (coverage: DemoCoverage) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestPendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<AssistantStage>("questions");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<CoveragePreferences>>({});
  const [optionalNote, setOptionalNote] = useState("");
  const [recommendation, setRecommendation] = useState<CoverageRecommendation | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(0);

  const closeAssistant = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStage((current) => (current === "loading" ? "note" : current));
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAssistant();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAssistant, open]);

  useEffect(() => {
    if (stage !== "loading") return;
    const interval = window.setInterval(
      () => setLoadingMessage((current) => (current + 1) % LOADING_MESSAGES.length),
      1_500,
    );
    return () => window.clearInterval(interval);
  }, [stage]);

  const question = COVERAGE_ASSISTANT_QUESTIONS[questionIndex];
  const currentAnswer = question ? answers[question.key] : undefined;
  const vehicleName = formatVehicleName(vehicle.make, vehicle.model);

  const continueQuestion = () => {
    if (!currentAnswer) return;
    if (questionIndex === COVERAGE_ASSISTANT_QUESTIONS.length - 1) {
      setStage("note");
    } else {
      setQuestionIndex((current) => current + 1);
    }
  };

  const goBack = () => {
    if (stage === "note") {
      setStage("questions");
      setQuestionIndex(COVERAGE_ASSISTANT_QUESTIONS.length - 1);
    } else if (stage === "questions" && questionIndex > 0) {
      setQuestionIndex((current) => current - 1);
    }
  };

  const requestRecommendation = async () => {
    if (
      requestPendingRef.current ||
      Object.keys(answers).length !== COVERAGE_ASSISTANT_QUESTIONS.length
    ) return;
    requestPendingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingMessage(0);
    setStage("loading");
    try {
      const response = await fetch("/api/customer/coverage-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ vehicle, preferences: answers, optionalNote }),
      });
      const result: unknown = await response.json();
      const parsed = coverageRecommendationSchema.safeParse(
        (result as { recommendation?: unknown })?.recommendation,
      );
      if (!response.ok || !parsed.success) {
        setStage("error");
        return;
      }
      setRecommendation(parsed.data);
      setStage("result");
    } catch (error) {
      if ((error as Error).name !== "AbortError") setStage("error");
    } finally {
      abortRef.current = null;
      requestPendingRef.current = false;
    }
  };

  const acceptRecommendation = () => {
    if (!recommendation) return;
    onAccept(recommendation.recommendedCoverage);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const restart = () => {
    setRecommendation(null);
    setQuestionIndex(0);
    setStage("questions");
  };

  return (
    <>
      <aside className="mt-5 flex flex-col gap-4 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/80 to-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-label="AI coverage guidance">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--brand-teal)] ring-1 ring-teal-200" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.15 3.35L16.5 7.5l-3.35 1.15L12 12l-1.15-3.35L7.5 7.5l3.35-1.15L12 3Z"/><path d="m18.5 13 .75 2.25L21.5 16l-2.25.75L18.5 19l-.75-2.25L15.5 16l2.25-.75L18.5 13Z"/><path d="m5.5 13 .75 2.25L8.5 16l-2.25.75L5.5 19l-.75-2.25L2.5 16l2.25-.75L5.5 13Z"/></svg>
          </span>
          <div>
            <h3 className="font-semibold text-[var(--brand-navy)]">Not sure which coverage fits you?</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">Answer a few quick questions and InsureFlow AI can help you compare your options.</p>
          </div>
        </div>
        <Button ref={triggerRef} type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={() => setOpen(true)}>Help me choose</Button>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAssistant();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl motion-safe:animate-[coverage-dialog-in_180ms_ease-out] sm:max-w-xl sm:rounded-3xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">AI coverage assistant</p>
                <h2 id={titleId} className="mt-1 text-2xl font-semibold text-[var(--brand-navy)]">Help me choose</h2>
                <p id={descriptionId} className="mt-1 text-sm text-slate-600">A short, optional guide. You remain in control.</p>
              </div>
              <button ref={closeRef} type="button" onClick={closeAssistant} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-xl text-slate-500 transition hover:bg-slate-100 hover:text-[var(--brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]" aria-label="Close coverage assistant">×</button>
            </div>

            {stage === "questions" && question ? (
              <div className="mt-7">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-500"><span>Question {questionIndex + 1} of {COVERAGE_ASSISTANT_QUESTIONS.length}</span><span>{vehicleName} · {vehicle.year}</span></div>
                <div className="mt-3 grid grid-cols-5 gap-1" aria-hidden="true">{COVERAGE_ASSISTANT_QUESTIONS.map((_, index) => <span key={index} className={`h-1 rounded-full ${index <= questionIndex ? "bg-[var(--brand-teal)]" : "bg-slate-200"}`} />)}</div>
                <fieldset className="mt-6">
                  <legend className="text-lg font-semibold leading-7 text-[var(--brand-navy)]">{question.prompt}</legend>
                  <div className="mt-4 grid gap-2.5">
                    {question.options.map((option) => {
                      const checked = currentAnswer === option.value;
                      return (
                        <label key={option.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition focus-within:ring-2 focus-within:ring-[var(--brand-teal)] focus-within:ring-offset-2 ${checked ? "border-[var(--brand-teal)] bg-teal-50 text-[var(--brand-navy)]" : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}>
                          <input type="radio" name={question.key} value={option.value} checked={checked} onChange={() => setAnswers((current) => ({ ...current, [question.key]: option.value }))} className="size-4 accent-[var(--brand-teal)]" />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button type="button" variant="secondary" disabled={questionIndex === 0} onClick={goBack}>Back</Button>
                  <Button type="button" disabled={!currentAnswer} onClick={continueQuestion}>{questionIndex === COVERAGE_ASSISTANT_QUESTIONS.length - 1 ? "Continue" : "Next question"}</Button>
                </div>
              </div>
            ) : null}

            {stage === "note" ? (
              <div className="mt-7">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-teal)]">Optional context</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--brand-navy)]">Anything else you want us to consider?</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Your vehicle context is already included: {vehicleName} ({vehicle.year}), estimated value {formatCurrency(vehicle.estimatedValue)}.</p>
                <label htmlFor="coverage-assistant-note" className="mt-5 block text-sm font-medium text-slate-800">Additional context <span className="font-normal text-slate-500">(optional)</span></label>
                <TextArea id="coverage-assistant-note" value={optionalNote} onChange={(event) => setOptionalNote(event.target.value)} maxLength={500} rows={4} className="mt-2 resize-none" placeholder="For example: I drive daily, the car is new, or I mainly want the lowest cost." />
                <p className="mt-1 text-right text-xs text-slate-500">{optionalNote.length}/500</p>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="secondary" onClick={goBack}>Back</Button><Button type="button" onClick={requestRecommendation}>Get recommendation</Button></div>
              </div>
            ) : null}

            {stage === "loading" ? (
              <div className="flex min-h-80 flex-col items-center justify-center py-8 text-center" role="status" aria-live="polite">
                <div className="relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-50 to-sky-50 ring-1 ring-teal-100">
                  <span className="absolute inset-2 rounded-full border border-teal-200 motion-safe:animate-ping motion-reduce:animate-none" aria-hidden="true" />
                  <svg viewBox="0 0 24 24" className="size-9 text-[var(--brand-teal)] motion-safe:animate-pulse motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 1.15 3.35L16.5 7.5l-3.35 1.15L12 12l-1.15-3.35L7.5 7.5l3.35-1.15L12 3Z"/><path d="m18.5 13 .75 2.25L21.5 16l-2.25.75L18.5 19l-.75-2.25L15.5 16l2.25-.75L18.5 13Z"/></svg>
                </div>
                <h3 className="mt-6 text-xl font-semibold text-[var(--brand-navy)]">Finding the best fit for you</h3>
                <p className="mt-2 text-sm text-slate-600">{LOADING_MESSAGES[loadingMessage]}</p>
              </div>
            ) : null}

            {stage === "result" && recommendation ? (
              <div className="mt-7">
                <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">Recommended: {formatCoverageType(recommendation.recommendedCoverage)}</span>
                <h3 className="mt-4 text-2xl font-semibold leading-8 text-[var(--brand-navy)]">{recommendation.headline}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{recommendation.summary}</p>
                <ul className="mt-5 space-y-2.5">{recommendation.reasons.map((reason) => <li key={reason} className="flex gap-2.5 text-sm leading-6 text-slate-700"><span className="mt-1 text-[var(--brand-teal)]" aria-hidden="true">✓</span><span>{reason}</span></li>)}</ul>
                <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600"><strong className="text-[var(--brand-navy)]">Compared with the other option:</strong> {recommendation.comparisonNote}</div>
                <p className="mt-4 text-xs leading-5 text-slate-500">AI guidance is for demonstration purposes and does not constitute insurance or financial advice. You remain in control of your coverage selection.</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end"><Button type="button" variant="ghost" onClick={restart}>Change answers</Button><Button type="button" variant="secondary" onClick={closeAssistant}>Choose myself</Button><Button type="button" onClick={acceptRecommendation}>Use {formatCoverageType(recommendation.recommendedCoverage)}</Button></div>
              </div>
            ) : null}

            {stage === "error" ? (
              <div className="mt-8 py-6 text-center" role="alert">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500" aria-hidden="true">!</div>
                <h3 className="mt-4 text-xl font-semibold text-[var(--brand-navy)]">We couldn&apos;t generate a recommendation right now.</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">You can still compare the coverage options and choose manually.</p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button type="button" variant="secondary" onClick={closeAssistant}>Back to coverage</Button><Button type="button" onClick={requestRecommendation}>Try again</Button></div>
              </div>
            ) : null}

            {selectedCoverage && stage !== "result" && stage !== "loading" ? <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">Your current manual selection is {formatCoverageType(selectedCoverage)}. It will not change unless you accept a recommendation.</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
