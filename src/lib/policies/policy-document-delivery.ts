import "server-only";

import { Buffer } from "node:buffer";
import { formatCoverageType, formatCurrency, formatDate } from "@/lib/format";
import { generatePolicyPdf, type PolicyPdfData } from "@/lib/policies/policy-pdf";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AuthProfile } from "@/lib/auth/session";
import type { SupabaseClient } from "@supabase/supabase-js";

export const POLICY_DOCUMENT_BUCKET = "policy-documents";
export const POLICY_DOCUMENT_TYPE = "POLICY_DOCUMENT";
export const POLICY_DOCUMENT_MIME = "application/pdf";
export const POLICY_DOCUMENT_SIGNED_URL_SECONDS = 120;
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "InsureFlow <noreply@insureflow.infaqbh.me>";

export type PolicyDocumentMetadata = {
  policy_id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number | null;
};

export type PolicyDeliveryResult = {
  documentAvailable: boolean;
  emailSent: boolean;
  warning?: string;
};

type StoredPolicy = {
  id: string;
  policy_number: string;
  status: string;
  coverage_type: string;
  start_date: string;
  end_date: string;
  excess_amount: number | string;
  coverage_limit: number | string;
  annual_premium: number | string | null;
  purchase_request_id: string | null;
  vehicles?: {
    make: string;
    model: string;
    year: number;
    plate_number: string;
    vin: string | null;
  } | Array<{
    make: string;
    model: string;
    year: number;
    plate_number: string;
    vin: string | null;
  }> | null;
};

export const POLICY_DOCUMENT_DELIVERY_WARNING = "Your policy was issued successfully, but we couldn't deliver the policy document by email. You can try downloading it from your policy page once available.";
const EMAIL_DELIVERY_WARNING = "Your policy was issued successfully and its document is ready to download, but we couldn't deliver the policy email.";

function oneVehicle(policy: StoredPolicy) {
  if (!policy.vehicles) return null;
  return Array.isArray(policy.vehicles) ? (policy.vehicles[0] ?? null) : policy.vehicles;
}

function safePolicyFileName(policyNumber: string): string {
  const safeNumber = policyNumber.trim().replace(/[^A-Za-z0-9_-]+/g, "-");
  return `InsureFlow-${safeNumber}.pdf`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function getPolicyDocumentMetadata(
  policyId: string,
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<PolicyDocumentMetadata | null> {
  const { data, error } = await supabase
    .from("policy_documents")
    .select("policy_id, document_type, file_path, file_name, mime_type, file_size_bytes")
    .eq("policy_id", policyId)
    .eq("document_type", POLICY_DOCUMENT_TYPE)
    .maybeSingle();

  if (error) {
    console.error("Policy document metadata lookup failed:", { policyId, stage: "metadata_lookup" });
    return null;
  }
  return (data as PolicyDocumentMetadata | null) ?? null;
}

async function sendPolicyIssuedEmail({
  customer,
  pdfData,
  fileName,
  pdfBytes,
}: {
  customer: AuthProfile;
  pdfData: PolicyPdfData;
  fileName: string;
  pdfBytes: Uint8Array;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = customer.email?.trim();
  if (!apiKey || !recipient) {
    console.error("Policy issuance email configuration unavailable:", {
      policyId: pdfData.policy.policyNumber,
      hasApiKey: Boolean(apiKey),
      hasRecipient: Boolean(recipient),
    });
    return false;
  }

  const customerName = customer.full_name?.trim() || "Customer";
  const vehicleLabel = `${pdfData.vehicle.make} ${pdfData.vehicle.model} (${pdfData.vehicle.year})`;
  const policyPeriod = `${formatDate(pdfData.policy.startDate)} - ${formatDate(pdfData.policy.endDate)}`;
  const coverage = formatCoverageType(pdfData.policy.coverageType);
  const annualPremium = formatCurrency(pdfData.policy.annualPremium);
  const subject = `Your InsureFlow motor policy ${pdfData.policy.policyNumber}`;
  const text = [
    `Hi ${customerName},`,
    "",
    "Your simulated InsureFlow motor policy has been issued successfully. Your policy document is attached for your records.",
    "",
    `Policy: ${pdfData.policy.policyNumber}`,
    `Vehicle: ${vehicleLabel}`,
    `Coverage: ${coverage}`,
    `Policy period: ${policyPeriod}`,
    `Annual premium: ${annualPremium}`,
    "",
    "You can also view your policy and manage claims from your InsureFlow dashboard.",
    "",
    "InsureFlow is a portfolio demonstration. This policy and payment are simulated and do not create real insurance coverage.",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f7f8;font-family:Arial,Helvetica,sans-serif;color:#0b2b3d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f8;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dce5e8;border-radius:16px;overflow:hidden"><tr><td style="padding:26px 30px;border-top:5px solid #0b8781"><div style="font-size:13px;font-weight:700;letter-spacing:1.5px;color:#0b8781">INSUREFLOW</div><h1 style="margin:14px 0 8px;font-size:26px;line-height:1.25;color:#0b2b3d">Your motor policy has been issued</h1><p style="margin:0;color:#526675;line-height:1.6">Hi ${escapeHtml(customerName)},</p><p style="margin:18px 0;color:#334b5a;line-height:1.65">Your simulated InsureFlow motor policy has been issued successfully. Your policy document is attached for your records.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border-collapse:collapse">${[
    ["Policy", pdfData.policy.policyNumber],
    ["Vehicle", vehicleLabel],
    ["Coverage", coverage],
    ["Policy period", policyPeriod],
    ["Annual premium", annualPremium],
  ].map(([label, value]) => `<tr><td style="width:34%;padding:10px 0;border-bottom:1px solid #e8eef0;color:#6b7c88;font-size:13px">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #e8eef0;color:#0b2b3d;font-size:14px;font-weight:600">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="margin:18px 0;color:#334b5a;line-height:1.65">You can also view your policy and manage claims from your InsureFlow dashboard.</p><div style="margin-top:22px;padding:14px 16px;background:#eef8f6;border:1px solid #cce7e3;border-radius:10px;color:#315c59;font-size:12px;line-height:1.55">InsureFlow is a portfolio demonstration. This policy and payment are simulated and do not create real insurance coverage.</div></td></tr></table></td></tr></table></body></html>`;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `policy-issued-${pdfData.policy.policyNumber}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [recipient],
        subject,
        text,
        html,
        attachments: [{ filename: fileName, content: Buffer.from(pdfBytes).toString("base64") }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Policy issuance email failed:", { provider: "Resend", status: response.status, policyId: pdfData.policy.policyNumber });
      return false;
    }
    const responseBody = await response.json().catch(() => null) as { id?: string } | null;
    console.info("Policy issuance email accepted:", { provider: "Resend", responseId: responseBody?.id ?? null, policyId: pdfData.policy.policyNumber });
    return true;
  } catch (error) {
    console.error("Policy issuance email exception:", { provider: "Resend", errorType: error instanceof Error ? error.name : "UnknownError", policyId: pdfData.policy.policyNumber });
    return false;
  }
}

export async function deliverIssuedPolicyDocument({
  customer,
  policyId,
}: {
  customer: AuthProfile;
  policyId: string;
}): Promise<PolicyDeliveryResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("policies")
    .select("id, policy_number, status, coverage_type, start_date, end_date, excess_amount, coverage_limit, annual_premium, purchase_request_id, vehicles (make, model, year, plate_number, vin)")
    .eq("id", policyId)
    .eq("user_id", customer.id)
    .not("purchase_request_id", "is", null)
    .maybeSingle();

  if (error || !data) {
    console.error("Issued policy document source lookup failed:", { policyId, stage: "policy_lookup" });
    return { documentAvailable: false, emailSent: false, warning: POLICY_DOCUMENT_DELIVERY_WARNING };
  }

  const policy = data as StoredPolicy;
  const vehicle = oneVehicle(policy);
  const annualPremium = Number(policy.annual_premium);
  if (!vehicle || !Number.isFinite(annualPremium)) {
    console.error("Issued policy document source is incomplete:", { policyId, stage: "source_validation" });
    return { documentAvailable: false, emailSent: false, warning: POLICY_DOCUMENT_DELIVERY_WARNING };
  }

  const existing = await getPolicyDocumentMetadata(policyId, supabase);
  if (existing) return { documentAvailable: true, emailSent: false };

  const pdfData: PolicyPdfData = {
    policy: {
      policyNumber: policy.policy_number,
      status: policy.status,
      coverageType: policy.coverage_type,
      startDate: policy.start_date,
      endDate: policy.end_date,
      excessAmount: Number(policy.excess_amount),
      coverageLimit: Number(policy.coverage_limit),
      annualPremium,
    },
    customer: {
      fullName: customer.full_name,
      email: customer.email,
      phone: customer.phone,
    },
    vehicle: {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      plateNumber: vehicle.plate_number,
      vin: vehicle.vin,
    },
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generatePolicyPdf(pdfData);
  } catch (generationError) {
    console.error("Policy PDF generation failed:", { policyId, stage: "pdf_generation", errorType: generationError instanceof Error ? generationError.name : "UnknownError" });
    return { documentAvailable: false, emailSent: false, warning: POLICY_DOCUMENT_DELIVERY_WARNING };
  }

  const filePath = `${customer.id}/${policy.id}/policy-document.pdf`;
  const fileName = safePolicyFileName(policy.policy_number);
  const { error: uploadError } = await supabase.storage
    .from(POLICY_DOCUMENT_BUCKET)
    .upload(filePath, Buffer.from(pdfBytes), {
      contentType: POLICY_DOCUMENT_MIME,
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    console.error("Policy document upload failed:", { policyId, stage: "storage_upload" });
    return { documentAvailable: false, emailSent: false, warning: POLICY_DOCUMENT_DELIVERY_WARNING };
  }

  const { error: metadataError } = await supabase.from("policy_documents").insert({
    policy_id: policy.id,
    document_type: POLICY_DOCUMENT_TYPE,
    file_path: filePath,
    file_name: fileName,
    mime_type: POLICY_DOCUMENT_MIME,
    file_size_bytes: pdfBytes.byteLength,
  });

  if (metadataError) {
    if (metadataError.code === "23505") {
      const concurrent = await getPolicyDocumentMetadata(policyId, supabase);
      if (concurrent) return { documentAvailable: true, emailSent: false };
    }
    console.error("Policy document metadata creation failed:", { policyId, stage: "metadata_insert" });
    return { documentAvailable: false, emailSent: false, warning: POLICY_DOCUMENT_DELIVERY_WARNING };
  }

  const emailSent = await sendPolicyIssuedEmail({ customer, pdfData, fileName, pdfBytes });
  return emailSent
    ? { documentAvailable: true, emailSent: true }
    : { documentAvailable: true, emailSent: false, warning: EMAIL_DELIVERY_WARNING };
}
