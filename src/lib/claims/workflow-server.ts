import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendClaimStatusEmail, type ClaimEmailKind } from "@/lib/claims/emails";
import {
  canRunOfficerAction,
  isStaffClaimRole,
  transitionForOfficerAction,
  validateActionNote,
  type OfficerClaimAction,
} from "@/lib/claims/workflow";
import { createServiceRoleClient, getStorageBucket } from "@/lib/supabase/server";
import { validateFile } from "@/lib/validation/claim";
import type { AuthProfile } from "@/lib/auth/session";

export type ClaimMutationResult = {
  ok: boolean;
  error?: string;
  emailDelivered?: boolean;
};

type ClaimTransitionRow = {
  claim_id: string;
  previous_status: string;
  new_status: string;
  history_id: string;
  transitioned_at: string;
};

type ClaimNotificationSource = {
  claim_number: string;
  contact_email: string | null;
  policies?: {
    users?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
  } | Array<{
    users?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
  }> | null;
};

type SubmissionActorSource = {
  users?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function safeTransitionError(error: { code?: string; message?: string } | null): string {
  if (!error) return "We couldn't update this claim right now.";
  if (error.code === "P0002") return "This claim could not be found.";
  if (error.code === "42501") return "You are not authorized to update this claim.";
  if (error.code === "22023") return "This action is no longer valid for the claim's current status. Refresh and try again.";
  return "We couldn't update this claim right now. Please try again.";
}

async function notificationSource(
  claimId: string,
  supabase: SupabaseClient,
): Promise<{ claimNumber: string; recipient: string; customerName: string | null } | null> {
  const { data, error } = await supabase
    .from("claims")
    .select("claim_number, contact_email, policies (users (full_name, email))")
    .eq("id", claimId)
    .maybeSingle();
  if (error || !data) {
    console.error("Claim notification source lookup failed:", { claimId, stage: "notification_lookup" });
    return null;
  }
  const claim = data as ClaimNotificationSource;
  const policy = one(claim.policies);
  const policyCustomer = one(policy?.users);
  const { data: submission } = await supabase
    .from("claim_status_history")
    .select("users (full_name, email)")
    .eq("claim_id", claimId)
    .eq("action", "CLAIM_SUBMITTED")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const submittingCustomer = one((submission as SubmissionActorSource | null)?.users);
  const recipient =
    submittingCustomer?.email?.trim() ||
    claim.contact_email?.trim() ||
    policyCustomer?.email?.trim() ||
    "";
  if (!recipient) return null;
  return {
    claimNumber: claim.claim_number,
    recipient,
    customerName: submittingCustomer?.full_name || policyCustomer?.full_name || null,
  };
}

function emailKindForAction(action: OfficerClaimAction): ClaimEmailKind | null {
  if (action === "request_more_info") return "MORE_INFO_REQUIRED";
  if (action === "approve") return "APPROVED";
  if (action === "reject") return "REJECTED";
  return null;
}

export async function runOfficerClaimAction(params: {
  claimId: string;
  action: OfficerClaimAction;
  note: unknown;
  staff: AuthProfile;
  supabase?: SupabaseClient;
}): Promise<ClaimMutationResult> {
  if (!isStaffClaimRole(params.staff.role)) {
    return { ok: false, error: "You are not authorized to update this claim." };
  }

  const noteValidation = validateActionNote(params.action, params.note);
  if (noteValidation.error) return { ok: false, error: noteValidation.error };

  const supabase = params.supabase || createServiceRoleClient();
  const { data: current, error: currentError } = await supabase
    .from("claims")
    .select("status")
    .eq("id", params.claimId)
    .maybeSingle();
  if (currentError) return { ok: false, error: "We couldn't verify the claim's current status." };
  if (!current) return { ok: false, error: "This claim could not be found." };
  if (!canRunOfficerAction(String(current.status), params.action)) {
    return { ok: false, error: "This action is no longer valid for the claim's current status. Refresh and try again." };
  }

  const transition = transitionForOfficerAction(params.action);
  const { data, error } = await supabase.rpc("transition_claim_status", {
    p_claim_id: params.claimId,
    p_to_status: transition.toStatus,
    p_action: transition.historyAction,
    p_note: noteValidation.note,
    p_actor_user_id: params.staff.id,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    console.error("Officer claim transition failed:", {
      claimId: params.claimId,
      action: params.action,
      code: error?.code || null,
    });
    return { ok: false, error: safeTransitionError(error) };
  }

  const row = data[0] as ClaimTransitionRow;
  if (row.new_status !== transition.toStatus) {
    return { ok: false, error: "The claim was updated, but its status could not be confirmed." };
  }

  const emailKind = emailKindForAction(params.action);
  if (!emailKind) return { ok: true };
  const source = await notificationSource(params.claimId, supabase);
  if (!source) return { ok: true, emailDelivered: false };
  const emailDelivered = await sendClaimStatusEmail({
    kind: emailKind,
    recipient: source.recipient,
    customerName: source.customerName,
    claimId: params.claimId,
    claimNumber: source.claimNumber,
    note: noteValidation.note,
  });
  return { ok: true, emailDelivered };
}

function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._()+ -]+/g, "_").slice(0, 180);
}

function collectAdditionalFiles(formData: FormData): File[] {
  return formData
    .getAll("additionalFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function customerOwnsClaim(
  customerId: string,
  claimId: string,
  supabase: SupabaseClient,
): Promise<{ claimNumber: string; status: string } | null> {
  const { data: claim, error } = await supabase
    .from("claims")
    .select("claim_number, status, policy_id")
    .eq("id", claimId)
    .maybeSingle();
  if (error || !claim) return null;
  const { data: policy } = await supabase
    .from("policies")
    .select("user_id")
    .eq("id", claim.policy_id)
    .maybeSingle();
  if (policy?.user_id === customerId) {
    return { claimNumber: claim.claim_number, status: claim.status };
  }
  const { data: link } = await supabase
    .from("customer_policy_links")
    .select("id")
    .eq("portal_user_id", customerId)
    .eq("policy_id", claim.policy_id)
    .maybeSingle();
  return link ? { claimNumber: claim.claim_number, status: claim.status } : null;
}

export async function submitCustomerClaimResponse(params: {
  claimId: string;
  formData: FormData;
  customer: AuthProfile;
  supabase?: SupabaseClient;
}): Promise<ClaimMutationResult> {
  const supabase = params.supabase || createServiceRoleClient();
  const authorized = await customerOwnsClaim(params.customer.id, params.claimId, supabase);
  if (!authorized) return { ok: false, error: "This claim could not be found." };
  if (String(authorized.status).toUpperCase() !== "MORE_INFO_REQUIRED") {
    return { ok: false, error: "This claim is not currently waiting for additional information." };
  }

  const responseMessage = String(params.formData.get("responseMessage") || "").trim();
  const files = collectAdditionalFiles(params.formData);
  if (!responseMessage && files.length === 0) {
    return { ok: false, error: "Add a response message or at least one supporting file." };
  }
  if (responseMessage.length > 1000) {
    return { ok: false, error: "Keep your response within 1,000 characters." };
  }
  if (files.length > 8) return { ok: false, error: "Upload no more than 8 additional files at a time." };
  for (const file of files) {
    const error = validateFile(file);
    if (error) return { ok: false, error };
  }

  const uploadedPaths: string[] = [];
  const documentIds: string[] = [];
  const bucket = getStorageBucket();
  try {
    for (const [index, file] of files.entries()) {
      const filePath = `${authorized.claimNumber}/additional-information-${Date.now()}-${index}-${safeFileName(file.name)}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (uploadError) throw new Error("upload");
      uploadedPaths.push(filePath);
      const { data: document, error: documentError } = await supabase
        .from("claim_documents")
        .insert({
          claim_id: params.claimId,
          document_type: "ADDITIONAL_INFORMATION",
          file_name: file.name,
          file_path: filePath,
        })
        .select("id")
        .single();
      if (documentError || !document) throw new Error("metadata");
      documentIds.push(document.id);
    }

    const { data, error } = await supabase.rpc("transition_claim_status", {
      p_claim_id: params.claimId,
      p_to_status: "UNDER_REVIEW",
      p_action: "CUSTOMER_INFO_SUBMITTED",
      p_note: responseMessage || null,
      p_actor_user_id: params.customer.id,
    });
    if (error || !Array.isArray(data) || !data[0]) {
      throw Object.assign(new Error("transition"), { cause: error });
    }
    return { ok: true };
  } catch (error) {
    if (documentIds.length > 0) {
      await supabase.from("claim_documents").delete().in("id", documentIds);
    }
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(bucket).remove(uploadedPaths);
    }
    console.error("Customer additional information submission failed:", {
      claimId: params.claimId,
      stage: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: error instanceof Error && error.message === "transition"
        ? "This claim changed while you were responding. Refresh and try again."
        : "We couldn't submit the additional information right now. Please try again.",
    };
  }
}
