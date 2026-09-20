import type { Metadata } from "next";
import { getLegalPageNavigation, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Cookie Policy | InsureFlow" };

export default async function CookiePolicyPage() {
  const navigation = await getLegalPageNavigation();
  return (
    <LegalPage
      {...navigation}
      title="Cookie Policy"
      introduction="This Cookie Policy explains how InsureFlow uses cookies and similar browser storage when you use this portfolio demonstration."
      sections={[
        {
          title: "What cookies and browser storage are",
          paragraphs: [
            "Cookies and similar browser storage help websites remember information between visits. They can be used to maintain sessions, protect account access, and remember simple preferences.",
          ],
        },
        {
          title: "How InsureFlow uses them",
          paragraphs: [
            "InsureFlow currently uses essential cookies and browser storage to:",
          ],
          bullets: [
            "keep users signed in",
            "maintain secure authenticated sessions",
            "support account and application functionality",
            "remember whether the cookie notice has been acknowledged",
          ],
          closingParagraphs: [
            "These technologies are necessary for core features of the application to work correctly.",
          ],
        },
        {
          title: "Essential cookies and storage",
          paragraphs: [
            "Essential cookies and storage are required for features such as sign-in, account security, and session continuity.",
            "They are not disabled by the cookie notice because they are necessary for the application to function.",
          ],
        },
        {
          title: "Optional cookies",
          paragraphs: [
            "InsureFlow does not currently use advertising, analytics, marketing, or behavioral-tracking cookies.",
            "If optional technologies are introduced in the future, users will be given appropriate information and controls before those technologies are enabled.",
          ],
        },
        {
          title: "Cookie notice acknowledgement",
          paragraphs: [
            "When you select Got it, InsureFlow stores a small acknowledgement in your browser so the notice does not appear repeatedly.",
            "This acknowledgement does not contain your name, email address, account ID, claim information, policy information, or other personal data.",
          ],
        },
        {
          title: "Managing cookies",
          paragraphs: [
            "You can clear or block cookies and browser storage through your browser settings.",
            "However, blocking essential storage may prevent features such as sign-in and authenticated access from working correctly.",
          ],
        },
        {
          title: "Demo environment",
          paragraphs: [
            "InsureFlow is a portfolio demonstration and is not a live insurer or regulated insurance service.",
            "Users should avoid submitting real or sensitive personal information and should use demonstration data wherever possible.",
          ],
        },
        { title: "Last updated", paragraphs: ["September 21, 2026"] },
      ]}
    />
  );
}
