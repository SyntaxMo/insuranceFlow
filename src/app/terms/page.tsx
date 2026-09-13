import type { Metadata } from "next";
import { getLegalPageNavigation, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms & Conditions | InsureFlow" };

export default async function TermsPage() {
  const navigation = await getLegalPageNavigation();
  return <LegalPage {...navigation} title="Terms & Conditions" introduction="These terms explain the intended use of InsureFlow as a software portfolio demonstration. InsureFlow does not provide real insurance products or services." sections={[
    { title: "Introduction", paragraphs: ["By using this demonstration, you agree to use it only for evaluation, learning, or portfolio review purposes."] },
    { title: "Demo nature of the platform", paragraphs: ["InsureFlow is a demonstration platform. It is not a licensed insurer, broker, claims administrator, payment provider, or regulated insurance service."] },
    { title: "Account responsibilities", paragraphs: ["You are responsible for keeping your demonstration account credentials secure and for activity performed through your account."] },
    { title: "Accuracy of information", paragraphs: ["Information entered into the platform should be accurate for the scenario being demonstrated. Because this is a demo, avoid entering real or sensitive personal, financial, or insurance information."] },
    { title: "Simulated quotes", paragraphs: ["Quotes use simplified, deterministic demonstration pricing rules. They are not offers of insurance, actuarial assessments, or real underwriting decisions."] },
    { title: "Simulated policy issuance", paragraphs: ["Policies produced by InsureFlow are demonstration records only. They are not insurance contracts, do not create actual insurance coverage, and are not legally binding policy documents."] },
    { title: "Simulated payments", paragraphs: ["The payment step is simulated. No card details are collected, no money is transferred, and no financial transaction takes place."] },
    { title: "Claims demonstration", paragraphs: ["Claim submission and review features demonstrate a possible workflow. They do not notify a real insurer, open a real claim, establish liability, or create entitlement to payment."] },
    { title: "AI-assisted features", paragraphs: ["AI may assist with document analysis, summaries, missing information, inconsistencies, and risk flags. AI output may be incomplete or inaccurate. AI-assisted outputs are advisory and require human review."], bullets: ["AI does not approve or reject claims.", "AI does not issue binding coverage decisions.", "AI does not set real premiums or perform real underwriting."] },
    { title: "Prohibited use", paragraphs: ["Do not use InsureFlow to misrepresent insurance coverage, process real financial transactions, make real insurance decisions, or upload unlawful or harmful material."] },
    { title: "Availability and changes", paragraphs: ["Features, example data, and demonstration behavior may change or become unavailable as the portfolio project evolves."] },
    { title: "Limitation of reliance", paragraphs: ["Do not rely on InsureFlow for financial, legal, insurance, claims, safety, or regulatory decisions. Seek advice from appropriately qualified professionals and licensed providers."] },
    { title: "Third-party services", paragraphs: ["InsureFlow may use third-party services to support authentication, data storage, transactional email, and AI-assisted features. Their availability and data-processing practices are subject to their own terms and policies."] },
    { title: "Contact", paragraphs: ["For demonstration-related questions, use the contact channel provided with the InsureFlow project portfolio."] },
    { title: "Last updated", paragraphs: ["September 13, 2026"] },
  ]} />;
}
