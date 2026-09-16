import "server-only";

import { formatDate } from "@/lib/format";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const CLAIM_EMAIL_SENDER = "InsureFlow <noreply@insureflow.infaqbh.me>";

export type ClaimEmailKind = "MORE_INFO_REQUIRED" | "APPROVED" | "REJECTED";

export type ClaimEmailInput = {
  kind: ClaimEmailKind;
  recipient: string;
  customerName: string | null;
  claimId: string;
  claimNumber: string;
  note: string | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] || character;
  });
}

function emailCopy(input: ClaimEmailInput) {
  if (input.kind === "MORE_INFO_REQUIRED") {
    return {
      subject: `More information needed for claim ${input.claimNumber}`,
      heading: "We need more information for your claim",
      body: "A Claims Officer needs some additional information before the review can continue.",
      noteLabel: "Information requested",
    };
  }
  if (input.kind === "APPROVED") {
    return {
      subject: `Your claim ${input.claimNumber} has been approved`,
      heading: "Your claim has been approved",
      body: "A Claims Officer approved your claim in the InsureFlow demonstration workflow.",
      noteLabel: "Decision note",
    };
  }
  return {
    subject: `Update on claim ${input.claimNumber}`,
    heading: "Your claim review has been updated",
    body: "A Claims Officer rejected your claim in the InsureFlow demonstration workflow.",
    noteLabel: "Reason",
  };
}

export function buildClaimEmail(input: ClaimEmailInput) {
  const copy = emailCopy(input);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const claimUrl = new URL(`/dashboard/claims/${encodeURIComponent(input.claimId)}`, siteUrl).toString();
  const greetingName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const noteText = input.note?.trim() || "No additional note was provided.";
  const plainText = [
    `Hi ${greetingName},`,
    "",
    copy.body,
    "",
    `Claim: ${input.claimNumber}`,
    `${copy.noteLabel}: ${noteText}`,
    `View your claim: ${claimUrl}`,
    "",
    "InsureFlow is a portfolio demonstration. This workflow does not represent a real insurance claim decision, settlement, or payment.",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f8f8;font-family:Inter,Helvetica,Arial,sans-serif;color:#102f43"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:30px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce8e7;border-radius:18px"><tr><td style="padding:30px"><p style="margin:0 0 18px;color:#0f8077;font-size:13px;font-weight:700;letter-spacing:.08em">INSUREFLOW</p><h1 style="margin:0;color:#102f43;font-size:26px;line-height:1.25">${escapeHtml(copy.heading)}</h1><p style="margin:18px 0 0;color:#405c6d;line-height:1.65">Hi ${escapeHtml(greetingName)},</p><p style="margin:10px 0;color:#405c6d;line-height:1.65">${escapeHtml(copy.body)}</p><div style="margin:22px 0;padding:18px;background:#f4faf9;border-left:3px solid #11887d;border-radius:10px"><p style="margin:0 0 8px;color:#607684;font-size:12px;text-transform:uppercase">Claim number</p><p style="margin:0 0 16px;font-weight:700">${escapeHtml(input.claimNumber)}</p><p style="margin:0 0 8px;color:#607684;font-size:12px;text-transform:uppercase">${escapeHtml(copy.noteLabel)}</p><p style="margin:0;white-space:pre-wrap;line-height:1.55">${escapeHtml(noteText)}</p></div><a href="${escapeHtml(claimUrl)}" style="display:inline-block;padding:12px 18px;background:#0f8077;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700">View claim</a><p style="margin:24px 0 0;color:#708390;font-size:12px;line-height:1.55">InsureFlow is a portfolio demonstration. This workflow does not represent a real insurance claim decision, settlement, or payment. Sent ${escapeHtml(formatDate(new Date().toISOString()))}.</p></td></tr></table></td></tr></table></body></html>`;

  return { subject: copy.subject, html, text: plainText };
}

export async function sendClaimStatusEmail(input: ClaimEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !input.recipient.trim()) {
    console.error("Claim status email unavailable:", {
      stage: "configuration",
      kind: input.kind,
      claimNumber: input.claimNumber,
    });
    return false;
  }

  const content = buildClaimEmail(input);
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CLAIM_EMAIL_SENDER,
        to: [input.recipient],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Claim status email failed:", {
        provider: "Resend",
        status: response.status,
        kind: input.kind,
        claimNumber: input.claimNumber,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Claim status email exception:", {
      provider: "Resend",
      errorType: error instanceof Error ? error.name : "UnknownError",
      kind: input.kind,
      claimNumber: input.claimNumber,
    });
    return false;
  }
}
