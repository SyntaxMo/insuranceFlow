import type { Metadata } from "next";
import { getLegalPageNavigation, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Cookie Policy | InsureFlow" };

export default async function CookiePolicyPage() {
  const navigation = await getLegalPageNavigation();
  return (
    <LegalPage
      {...navigation}
      title="Cookie Policy"
      introduction="This policy explains how the InsureFlow portfolio demonstration uses essential cookies and browser storage."
      sections={[
        {
          title: "What cookies and browser storage are",
          paragraphs: [
            "Cookies are small pieces of information stored by your browser. Similar browser storage can remember limited settings on a device. They help websites maintain sessions and remember simple choices between visits.",
          ],
        },
        {
          title: "What InsureFlow uses",
          paragraphs: [
            "InsureFlow uses essential authentication and session information to support sign-in, session continuity, account security, and access to customer and staff features. It also stores a small local acknowledgement when a visitor dismisses the public cookie notice.",
          ],
        },
        {
          title: "Essential cookies and storage",
          paragraphs: [
            "Essential cookies and storage are required to sign in, maintain an authenticated session, protect account access, synchronize session changes, and keep core application features working. They are not blocked by the public notice and cannot be disabled through that notice while using authenticated features.",
          ],
        },
        {
          title: "Optional cookies",
          paragraphs: [
            "InsureFlow does not currently use advertising or analytics cookies. It does not add optional marketing or behavioral tracking through the cookie notice.",
          ],
        },
        {
          title: "Cookie notice acknowledgement",
          paragraphs: [
            "When you select Got it, InsureFlow stores only the current notice version and the fact that it was acknowledged. This acknowledgement contains no name, email address, user identifier, claim information, or policy information.",
          ],
        },
        {
          title: "Managing cookies",
          paragraphs: [
            "You can clear or block cookies and browser storage using your browser settings. Blocking essential storage may prevent sign-in, authenticated sessions, or other core features from working correctly.",
          ],
        },
        {
          title: "Future changes",
          paragraphs: [
            "If InsureFlow introduces optional analytics or similar technologies in the future, visitors will be given appropriate information and controls before those optional technologies are enabled.",
          ],
        },
        {
          title: "Demo environment",
          paragraphs: [
            "InsureFlow is a software portfolio demonstration, not a live insurer or regulated insurance service. Use demonstration or non-sensitive information wherever possible.",
          ],
        },
        { title: "Last updated", paragraphs: ["September 21, 2026"] },
      ]}
    />
  );
}
