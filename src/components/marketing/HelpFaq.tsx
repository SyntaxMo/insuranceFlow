"use client";

import { useState } from "react";
import styles from "./HelpFaq.module.css";

const faqs = [
  {
    question: "How do I link an existing policy?",
    answer: "Enter the existing policy details in your dashboard, then confirm ownership using the verification code sent to the policyholder's registered email.",
  },
  {
    question: "How does the demo quote work?",
    answer: "InsureFlow uses deterministic demonstration rules based on the selected coverage, estimated vehicle value, and vehicle age. It is not real underwriting.",
  },
  {
    question: "Is this real insurance?",
    answer: "No. InsureFlow is a software portfolio demonstration. Its quotes and policy records do not create real insurance coverage.",
  },
  {
    question: "Are payments real?",
    answer: "No. Payment is simulated for the demonstration and no real money is transferred.",
  },
  {
    question: "Can AI approve or reject my claim?",
    answer: "No. AI can assist staff with summaries, missing information, inconsistencies, and review flags. Human claims staff make the decisions.",
  },
  {
    question: "What is the difference between Comprehensive and Third Party?",
    answer: "In this simplified demo, Comprehensive may include own-vehicle damage examples and third-party liability. Third Party focuses on liability involving other people and property.",
  },
  {
    question: "Can I remove a linked policy from my account?",
    answer: "Yes, where no active claim blocks removal. This only removes portal access to the linked policy; it does not cancel the insurance policy.",
  },
  {
    question: "Can I file a claim through InsureFlow?",
    answer: "Yes. Signed-in customers can submit demo motor claims, upload supporting documents, and follow claim status updates.",
  },
] as const;

export function HelpFaq() {
  const [expanded, setExpanded] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);

  const toggleFaqs = () => {
    setExpanded((current) => {
      if (current) setOpenQuestion(null);
      return !current;
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-[-0.035em] text-[var(--brand-navy)] sm:text-4xl">Need help?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Find quick answers about policies, claims, payments, and AI.</p>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="landing-faq-list"
          onClick={toggleFaqs}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--brand-teal)] transition hover:text-[var(--brand-teal-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]"
        >
          {expanded ? "Hide FAQs" : "View FAQs"}
          <svg viewBox="0 0 20 20" aria-hidden="true" className={`${styles.chevron} size-4 ${expanded ? styles.chevronOpen : ""}`} fill="none"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <div id="landing-faq-list" className={`${styles.faqReveal} ${expanded ? styles.faqRevealOpen : ""}`} aria-hidden={!expanded} inert={!expanded ? true : undefined}>
        <div className={styles.faqRevealInner}>
          <div className="mt-10 border-b border-slate-200">
            {faqs.map((faq, index) => {
              const isOpen = openQuestion === index;
              const answerId = `landing-faq-answer-${index}`;
              return (
                <div key={faq.question} className="border-t border-slate-200">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      onClick={() => setOpenQuestion(isOpen ? null : index)}
                      className="group flex min-h-16 w-full items-center justify-between gap-5 py-4 text-left text-sm font-semibold text-[var(--brand-navy)] transition hover:text-[var(--brand-teal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] sm:text-base"
                    >
                      <span>{faq.question}</span>
                      <span aria-hidden="true" className={`${styles.plus} shrink-0 text-xl font-light text-slate-400 group-hover:text-[var(--brand-teal)] ${isOpen ? styles.plusOpen : ""}`}>+</span>
                    </button>
                  </h3>
                  <div id={answerId} role="region" aria-label={faq.question} aria-hidden={!isOpen} className={`${styles.answer} ${isOpen ? styles.answerOpen : ""}`}>
                    <div className={styles.answerInner}><p className="max-w-3xl pb-5 pr-8 text-sm leading-6 text-slate-600">{faq.answer}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
