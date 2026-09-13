import type { Metadata } from "next";
import { getLegalPageNavigation, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Insurance & Demo Disclaimer | InsureFlow" };

export default async function DisclaimerPage() {
  const navigation = await getLegalPageNavigation();
  return <LegalPage {...navigation} title="Insurance & Demo Disclaimer" introduction="InsureFlow demonstrates insurance-related software workflows. It does not provide insurance, financial, legal, or claims services." sections={[
    { title: "Software demonstration", paragraphs: ["InsureFlow is a portfolio software demonstration. It is not a licensed insurer, insurance intermediary, claims administrator, financial institution, or legal adviser."] },
    { title: "Simulated quotes and pricing", paragraphs: ["All quotes are simulated using simplified demonstration rules. The calculations are not actuarial insurance rates, real underwriting, or an offer to provide insurance."] },
    { title: "Simulated policies and coverage", paragraphs: ["Policy issuance is simulated. Records created by the platform are not binding insurance contracts. No actual insurance coverage, benefit, protection, or insurer obligation is created."] },
    { title: "Simulated payments", paragraphs: ["No real payment is processed. The demonstration does not collect payment-card credentials or move money."] },
    { title: "Claims demonstration", paragraphs: ["Claims and document workflows are for demonstration purposes. Submitting information does not open a real insurance claim or determine liability, coverage, settlement, repair, or payment."] },
    { title: "AI assistance", paragraphs: ["AI output is assistive only and may be incomplete or incorrect. AI may summarize documents and identify missing information, inconsistencies, or risk flags for human review. Any AI-assisted output should be reviewed by a human and should not be treated as authoritative."], bullets: ["AI does not approve or reject claims.", "AI does not decide legal liability.", "AI does not make binding coverage decisions.", "AI does not set real premiums or perform real underwriting."] },
    { title: "No guarantee of accuracy or availability", paragraphs: ["InsureFlow may contain incomplete, experimental, or changing features. Demonstration outputs, calculations, and generated content may contain errors and are provided for evaluation purposes only."] },
    { title: "No professional reliance", paragraphs: ["Do not use InsureFlow or its outputs for real financial, legal, insurance, safety, regulatory, or claims decisions. Consult licensed providers and qualified professionals for real-world needs."] },
    { title: "Demo data notice", paragraphs: ["Use demonstration or non-sensitive data. Avoid entering real sensitive personal, financial, medical, legal, or insurance information into this portfolio environment."] },
    { title: "Last updated", paragraphs: ["September 13, 2026"] },
  ]} />;
}
