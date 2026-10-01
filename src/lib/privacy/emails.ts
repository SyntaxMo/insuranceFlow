import "server-only";
import { CLAIM_EMAIL_SENDER } from "@/lib/claims/emails";

type RequestEmailInput = { recipient: string; customerName: string | null; requestId: string };
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function buildDataDeletionRequestEmail(input: RequestEmailInput) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredSiteUrl && process.env.NODE_ENV === "production") throw new Error("Site URL required");
  const profileUrl = new URL("/dashboard/profile", configuredSiteUrl || "http://localhost:3000").toString();
  const name = input.customerName?.trim() || "there";
  const body = "Your data deletion request has been recorded for review and is pending. Your account and existing records remain available while the request is pending.";
  const disclaimer = "This feature simulates a privacy request workflow and does not represent a real statutory deletion process. Some records may be retained for security, historical workflow integrity, or system maintenance.";
  return {
    subject: "We received your data deletion request",
    text: `Hi ${name},\n\n${body}\n\nView your profile: ${profileUrl}\n\n${disclaimer}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;color:#102f43;line-height:1.6;max-width:620px"><p style="color:#0f8077;font-weight:700">INSUREFLOW</p><h1 style="font-size:26px">Request received</h1><p>Hi ${escapeHtml(name)},</p><p>${body}</p><a href="${escapeHtml(profileUrl)}" style="display:inline-block;background:#0f8077;color:white;padding:12px 18px;border-radius:10px;text-decoration:none">View profile</a><p style="font-size:12px;color:#607684">${disclaimer}</p></div>`,
  };
}

export async function sendDataDeletionRequestEmail(input: RequestEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !input.recipient.trim()) {
    console.error("Data deletion confirmation email unavailable:", { category: "configuration" });
    return false;
  }
  try {
    const email = buildDataDeletionRequestEmail(input);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `data-deletion-request:${input.requestId}` },
      body: JSON.stringify({ from: CLAIM_EMAIL_SENDER, to: [input.recipient], ...email }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Data deletion confirmation email failed:", { provider: "Resend", status: response.status });
      return false;
    }
    return true;
  } catch {
    console.error("Data deletion confirmation email failed:", { category: "delivery" });
    return false;
  }
}
