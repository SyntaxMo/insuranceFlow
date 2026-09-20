import type { Metadata } from "next";
import { getLegalPageNavigation, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy | InsureFlow" };

export default async function PrivacyPage() {
  const navigation = await getLegalPageNavigation();
  return <LegalPage {...navigation} title="Privacy Policy" introduction="This notice describes the information handled by the InsureFlow demonstration and how it supports the product experience." sections={[
    { title: "Information collected", paragraphs: ["The demonstration may process information you provide, records created through use of the application, and limited technical information required to operate and secure the service."] },
    { title: "Account information", paragraphs: ["Account data may include your name, email address, phone number, login-related identifiers, and assigned portal role."] },
    { title: "Vehicle and policy information", paragraphs: ["Vehicle details, policy records, coverage selections, simulated quotes, and policy-link verification information may be stored to demonstrate customer workflows."] },
    { title: "Claim information and uploaded documents", paragraphs: ["Claim descriptions, accident details, contact information, photographs, police reports, and repair estimates may be processed when submitted to the demonstration."] },
    { title: "How information is used", bullets: ["Provide account, policy, claim, and administrative demonstration features.", "Authenticate users and apply role-based access.", "Send transactional confirmation and verification messages.", "Generate AI-assisted claim-analysis outputs for human review.", "Maintain the security and reliability of the demonstration."] },
    { title: "Authentication and security", paragraphs: ["InsureFlow uses access controls, authenticated sessions, server-side authorization, and database security policies appropriate to its current architecture. No system can guarantee absolute security."] },
    { title: "Cookies and browser storage", paragraphs: ["InsureFlow uses essential cookies and browser storage for authentication, session continuity, security, and remembering acknowledgement of the public cookie notice. It does not currently use advertising or analytics cookies. See the Cookie Policy for more information."] },
    { title: "AI processing", paragraphs: ["Claim information and supported documents may be sent through OpenRouter to an available AI model provider for analysis. Depending on the model selected through OpenRouter, information may be processed by a downstream model provider. AI may summarize information or identify missing details, inconsistencies, and review flags. It does not make binding claim, coverage, pricing, or underwriting decisions."] },
    { title: "Email communications", paragraphs: ["Transactional emails, including policy-link verification codes, may be delivered using Resend. Supabase may also deliver authentication-related email through the configured email service."] },
    { title: "Data retention", paragraphs: ["Demonstration data may remain in the configured database and storage services until it is removed during project maintenance or through a future data-management feature. No fixed retention period is promised for this portfolio environment."] },
    { title: "Verification and operational records", paragraphs: ["InsureFlow may create temporary or operational records needed to support features such as email verification, policy linking, duplicate-submission protection, and system security. These records are used to operate the demonstration and are not intended as customer-facing insurance records."] },
    { title: "Third-party services", paragraphs: ["The current architecture uses Supabase for authentication, database, and file storage; Resend for transactional email; and OpenRouter and downstream model providers for AI-assisted claim analysis. Their handling of data is also governed by their own terms and policies."] },
    { title: "User choices", paragraphs: ["You may choose not to enter optional information or upload optional documents. Some demonstration features require particular information to operate."] },
    { title: "Data access and deletion", paragraphs: ["The current portfolio version does not provide a complete self-service data export or deletion workflow. Demonstration data may be removed as part of project maintenance."] },
    { title: "Demo environment", paragraphs: ["Because InsureFlow is a portfolio demonstration, use demonstration or non-sensitive data wherever possible. Avoid submitting real sensitive personal, financial, medical, legal, or insurance information."] },
    { title: "Contact", paragraphs: ["For demonstration-related privacy questions, use the contact channel provided with the InsureFlow project portfolio."] },
    { title: "Last updated", paragraphs: ["September 21, 2026"] },
  ]} />;
}
