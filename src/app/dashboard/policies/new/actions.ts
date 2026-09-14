"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/auth/session";
import { calculateDemoQuote, type DemoQuote } from "@/lib/policies/quote";
import { flattenPurchaseErrors, policyPurchaseSchema, quoteRequestSchema } from "@/lib/policies/purchase";
import { deliverIssuedPolicyDocument, POLICY_DOCUMENT_DELIVERY_WARNING, type PolicyDeliveryResult } from "@/lib/policies/policy-document-delivery";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type QuoteActionResult =
  | { ok: true; quote: DemoQuote; startDate: string; endDate: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export type IssuePolicyState = {
  status: "idle" | "error" | "success";
  message?: string;
  deliveryWarning?: string;
  fieldErrors?: Record<string, string>;
  policy?: {
    id: string;
    policyNumber: string;
    startDate: string;
    endDate: string;
    annualPremium: number;
    excess: number;
    coverageLabel: string;
    documentAvailable: boolean;
  };
};

function policyDates() {
  const start = new Date();
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export async function getDemoPolicyQuote(input: unknown): Promise<QuoteActionResult> {
  await requireCustomer();
  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the vehicle and coverage details.", fieldErrors: flattenPurchaseErrors(parsed.error) };
  }

  const quote = calculateDemoQuote({
    coverage: parsed.data.coverage,
    estimatedVehicleValue: parsed.data.estimatedVehicleValue,
    vehicleYear: parsed.data.year,
  });
  return { ok: true, quote, ...policyDates() };
}

export async function issueDemoPolicy(
  _previous: IssuePolicyState,
  formData: FormData,
): Promise<IssuePolicyState> {
  const customer = await requireCustomer();
  const parsed = policyPurchaseSchema.safeParse({
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    plateNumber: formData.get("plateNumber"),
    vin: formData.get("vin") ?? "",
    estimatedVehicleValue: formData.get("estimatedVehicleValue"),
    coverage: formData.get("coverage"),
    requestId: formData.get("requestId"),
    consentAccepted: formData.get("consentAccepted"),
  });
  if (!parsed.success) {
    const fieldErrors = flattenPurchaseErrors(parsed.error);
    return {
      status: "error",
      message: fieldErrors.consentAccepted ?? "Check the policy details and try again.",
      fieldErrors,
    };
  }

  // Client-supplied price, dates, status, IDs, and policy numbers are deliberately ignored.
  const quote = calculateDemoQuote({
    coverage: parsed.data.coverage,
    estimatedVehicleValue: parsed.data.estimatedVehicleValue,
    vehicleYear: parsed.data.year,
  });
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("issue_demo_motor_policy", {
    p_portal_user_id: customer.id,
    p_request_id: parsed.data.requestId,
    p_make: parsed.data.make,
    p_model: parsed.data.model,
    p_year: parsed.data.year,
    p_plate_number: parsed.data.plateNumber,
    p_vin: parsed.data.vin,
    p_coverage_type: quote.coverageLabel,
    p_excess_amount: quote.excess,
    p_coverage_limit: quote.coverageLimit,
    p_annual_premium: quote.annualPremium,
  });

  if (error) {
    console.error("Demo policy issuance failed:", error.message);
    const migrationMissing = error.code === "PGRST202" || error.message.includes("issue_demo_motor_policy");
    return {
      status: "error",
      message: migrationMissing
        ? "Policy issuance is not configured yet. Please try again after the database update."
        : "We couldn't issue the policy right now. No payment was processed.",
    };
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.outcome !== "string") {
    console.error("Demo policy issuance returned an invalid result.");
    return { status: "error", message: "We couldn't issue the policy right now. No payment was processed." };
  }
  if (result.outcome === "duplicate_plate") {
    return { status: "error", message: "A vehicle with this plate number is already registered.", fieldErrors: { plateNumber: "A vehicle with this plate number is already registered." } };
  }
  if (result.outcome === "duplicate_vin") {
    return { status: "error", message: "A vehicle with this VIN is already registered.", fieldErrors: { vin: "A vehicle with this VIN is already registered." } };
  }
  if (!["issued", "already_issued"].includes(result.outcome) || !result.issued_policy_id || !result.issued_policy_number) {
    return { status: "error", message: "We couldn't issue the policy right now. No payment was processed." };
  }

  let delivery: PolicyDeliveryResult = {
    documentAvailable: false,
    emailSent: false,
    warning: POLICY_DOCUMENT_DELIVERY_WARNING,
  };
  try {
    delivery = await deliverIssuedPolicyDocument({
      customer,
      policyId: String(result.issued_policy_id),
    });
  } catch (deliveryError) {
    console.error("Post-issuance policy delivery failed:", {
      policyId: String(result.issued_policy_id),
      errorType: deliveryError instanceof Error ? deliveryError.name : "UnknownError",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/policies/${result.issued_policy_id}`);
  return {
    status: "success",
    deliveryWarning: delivery.warning,
    policy: {
      id: String(result.issued_policy_id),
      policyNumber: String(result.issued_policy_number),
      startDate: String(result.issued_start_date),
      endDate: String(result.issued_end_date),
      annualPremium: quote.annualPremium,
      excess: quote.excess,
      coverageLabel: quote.coverageLabel,
      documentAvailable: delivery.documentAvailable,
    },
  };
}
