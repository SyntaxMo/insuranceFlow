import "server-only";

import { formatDate, formatVehicleName } from "@/lib/format";

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

export type ClaimSubmissionEmailInput = {
  recipient: string;
  customerName: string | null;
  claimId: string;
  claimNumber: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
  };
  accidentDate: string;
  submittedAt: string;
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

export function buildClaimSubmissionEmail(input: ClaimSubmissionEmailInput) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const claimUrl = new URL(`/dashboard/claims/${encodeURIComponent(input.claimId)}`, siteUrl).toString();
  const greetingName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const vehicleName = `${formatVehicleName(input.vehicle.make, input.vehicle.model)} (${input.vehicle.year})`;
  const subject = `We received your claim ${input.claimNumber}`;
  const disclaimer = "InsureFlow is a portfolio demonstration. This workflow does not represent a real insurance claim decision, settlement, or payment.";
  const text = [
    `Hi ${greetingName},`,
    "",
    "We received your motor claim and it is now in the claims review queue.",
    "",
    `Claim number: ${input.claimNumber}`,
    `Vehicle: ${vehicleName}`,
    `Accident date: ${formatDate(input.accidentDate)}`,
    `Submitted date: ${formatDate(input.submittedAt)}`,
    "Status: New",
    "",
    `View claim: ${claimUrl}`,
    "",
    "You can track progress, review updates, and respond if the claims team requests additional information.",
    "",
    disclaimer,
  ].join("\n");

  const summaryRows = [
    ["Claim number", input.claimNumber],
    ["Vehicle", vehicleName],
    ["Accident date", formatDate(input.accidentDate)],
    ["Submitted date", formatDate(input.submittedAt)],
    ["Status", "New"],
  ]
    .map(
      ([label, value]) => `<tr><td style="padding:7px 12px 7px 0;color:#607684;font-size:12px;text-transform:uppercase;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;color:#102f43;font-weight:700;vertical-align:top">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f8f8;font-family:Inter,Helvetica,Arial,sans-serif;color:#102f43"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:30px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce8e7;border-radius:18px"><tr><td style="padding:30px"><p style="margin:0 0 18px;color:#0f8077;font-size:13px;font-weight:700;letter-spacing:.08em">INSUREFLOW</p><h1 style="margin:0;color:#102f43;font-size:26px;line-height:1.25">Your claim has been submitted</h1><p style="margin:18px 0 0;color:#405c6d;line-height:1.65">Hi ${escapeHtml(greetingName)},</p><p style="margin:10px 0;color:#405c6d;line-height:1.65">We received your motor claim and it is now in the claims review queue.</p><div style="margin:22px 0;padding:16px 18px;background:#f4faf9;border-left:3px solid #11887d;border-radius:10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${summaryRows}</table></div><a href="${escapeHtml(claimUrl)}" style="display:inline-block;padding:12px 18px;background:#0f8077;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700">View claim</a><p style="margin:22px 0 0;color:#405c6d;line-height:1.65">You can track progress, review updates, and respond if the claims team requests additional information.</p><p style="margin:24px 0 0;color:#708390;font-size:12px;line-height:1.55">${escapeHtml(disclaimer)}</p></td></tr></table></td></tr></table></body></html>`;

  return { subject, html, text };
}

async function sendResendEmail(params: {
  recipient: string;
  subject: string;
  html: string;
  text: string;
  logContext: Record<string, string>;
  idempotencyKey?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !params.recipient.trim()) {
    console.error("Claim email unavailable:", {
      stage: "configuration",
      ...params.logContext,
    });
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(params.idempotencyKey
          ? { "Idempotency-Key": params.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: CLAIM_EMAIL_SENDER,
        to: [params.recipient],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Claim email failed:", {
        provider: "Resend",
        status: response.status,
        ...params.logContext,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Claim email exception:", {
      provider: "Resend",
      errorType: error instanceof Error ? error.name : "UnknownError",
      ...params.logContext,
    });
    return false;
  }
}

export async function sendClaimSubmissionEmail(
  input: ClaimSubmissionEmailInput,
): Promise<boolean> {
  const content = buildClaimSubmissionEmail(input);
  return sendResendEmail({
    recipient: input.recipient,
    ...content,
    logContext: {
      kind: "CLAIM_SUBMITTED",
      claimNumber: input.claimNumber,
    },
    idempotencyKey: `claim-submitted/${input.claimId}`,
  });
}

export async function sendClaimStatusEmail(input: ClaimEmailInput): Promise<boolean> {
  const content = buildClaimEmail(input);
  return sendResendEmail({
    recipient: input.recipient,
    ...content,
    logContext: {
      kind: input.kind,
      claimNumber: input.claimNumber,
    },
  });
}
