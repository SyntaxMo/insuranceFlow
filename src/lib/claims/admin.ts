import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { mapPolicyToSummary } from "@/lib/claims/policy-eligibility";
import { safeErrorDetails } from "@/lib/ai/debug";
import type {
  Claim,
  ClaimDetailView,
  ClaimDocument,
  ClaimListItem,
  ClaimStatusHistory,
  Policy,
} from "@/types/database";

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function vehicleLabel(policy: Policy | null): string {
  const vehicle = asSingle(policy?.vehicles);
  if (!vehicle) return "Unknown vehicle";
  return `${vehicle.make} ${vehicle.model} (${vehicle.year})`;
}

type ListPolicy = Policy & {
  users?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

type ListClaimRow = Claim & {
  policies?: ListPolicy | ListPolicy[] | null;
  claim_ai_analyses?: Array<{ id: string }> | { id: string } | null;
};

export async function listClaims(): Promise<{
  claims: ClaimListItem[];
  error: string | null;
}> {
  try {
    const supabase = createServiceRoleClient();
    const [{ data, error }, { data: responseEvents, error: historyError }] = await Promise.all([
      supabase
        .from("claims")
        .select(`
          id, claim_number, accident_date, status, created_at, updated_at,
          policies (
            policy_number,
            users (full_name),
            vehicles (make, model, year, plate_number)
          ),
          claim_ai_analyses (id)
        `)
        .order("created_at", { ascending: false }),
      supabase
        .from("claim_status_history")
        .select("claim_id, action, created_at")
        .eq("action", "CUSTOMER_INFO_SUBMITTED")
        .order("created_at", { ascending: false }),
    ]);

    if (error || historyError) {
      console.error("listClaims failed:", error?.message || historyError?.message);
      return { claims: [], error: "Unable to load claims right now. Please try again shortly." };
    }

    const returnedClaims = new Set((responseEvents || []).map((event) => String(event.claim_id)));
    const claims: ClaimListItem[] = ((data || []) as ListClaimRow[]).map((claim) => {
      const policy = asSingle<ListPolicy>(claim.policies as ListPolicy | ListPolicy[] | null);
      const customer = asSingle(policy?.users);
      const analyses = claim.claim_ai_analyses
        ? Array.isArray(claim.claim_ai_analyses)
          ? claim.claim_ai_analyses
          : [claim.claim_ai_analyses]
        : [];
      return {
        id: claim.id,
        claimNumber: claim.claim_number,
        policyNumber: policy?.policy_number || "—",
        vehicleLabel: vehicleLabel(policy),
        accidentDate: claim.accident_date,
        status: String(claim.status),
        createdAt: claim.created_at,
        updatedAt: claim.updated_at || claim.created_at,
        customerName: customer?.full_name || "Customer",
        hasAiAnalysis: analyses.length > 0,
        customerResponded: returnedClaims.has(claim.id),
      };
    });
    return { claims, error: null };
  } catch (error) {
    console.error("listClaims exception:", safeErrorDetails(error));
    return { claims: [], error: "Unable to load claims due to a server error." };
  }
}

type DetailPolicy = Policy & {
  annual_premium?: number | string | null;
  users?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | Array<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
  }> | null;
};

type DetailClaimRow = Claim & { policies?: DetailPolicy | DetailPolicy[] | null };
type HistoryRow = ClaimStatusHistory & {
  users?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

function mimeFromFileName(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

export async function getClaimById(
  id: string,
): Promise<{ claim: ClaimDetailView | null; error: string | null }> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("claims")
      .select(`
        id, claim_number, accident_date, accident_location, description,
        contact_email, contact_phone, status, created_at, updated_at, policy_id,
        policies (
          id, user_id, vehicle_id, policy_number, status, start_date, end_date,
          coverage_type, excess_amount, coverage_limit, annual_premium,
          users (full_name, email, phone),
          vehicles (id, owner_id, make, model, year, plate_number, vin)
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[claim-review] claim read failed:", safeErrorDetails(error));
      return { claim: null, error: "Unable to load this claim right now. Please try again shortly." };
    }
    if (!data) return { claim: null, error: null };

    const claim = data as DetailClaimRow;
    const policy = asSingle<DetailPolicy>(claim.policies as DetailPolicy | DetailPolicy[] | null);
    if (!policy) return { claim: null, error: "Claim is missing policy details." };
    const summary = mapPolicyToSummary(policy);
    if (!summary) return { claim: null, error: "Claim is missing vehicle details." };
    const vehicle = asSingle(policy.vehicles);
    if (vehicle) summary.vehicle.vin = vehicle.vin || null;

    const [{ data: docs, error: docsError }, { data: history, error: historyError }] = await Promise.all([
      supabase
        .from("claim_documents")
        .select("id, claim_id, document_type, file_name, file_path, created_at")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("claim_status_history")
        .select("id, claim_id, from_status, to_status, action, note, actor_user_id, actor_role, created_at, users (full_name)")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: true }),
    ]);
    if (docsError || historyError) {
      console.error("[claim-review] related records read failed:", safeErrorDetails(docsError || historyError));
      return { claim: null, error: "Unable to load the complete claim record right now." };
    }

    const customer = asSingle(policy.users);
    const historyRows = ((history || []) as HistoryRow[]).map((event) => ({
      id: event.id,
      claim_id: event.claim_id,
      from_status: event.from_status,
      to_status: event.to_status,
      action: event.action,
      note: event.note,
      actor_user_id: event.actor_user_id,
      actor_role: event.actor_role,
      created_at: event.created_at,
      actorName: asSingle(event.users)?.full_name || null,
    }));
    const submittingActor = [...historyRows].reverse().find((event) => event.action === "CLAIM_SUBMITTED" && event.actorName);

    return {
      claim: {
        id: claim.id,
        claimNumber: claim.claim_number,
        status: String(claim.status),
        createdAt: claim.created_at,
        accidentDate: claim.accident_date,
        accidentLocation: claim.accident_location,
        description: claim.description,
        customerName: submittingActor?.actorName || customer?.full_name || "Customer",
        email: claim.contact_email || customer?.email || "",
        phone: claim.contact_phone || customer?.phone || "",
        policyStatus: String(policy.status),
        annualPremium: policy.annual_premium == null ? null : Number(policy.annual_premium),
        policy: summary,
        documents: ((docs || []) as ClaimDocument[]).map((document) => ({
          id: document.id,
          documentType: String(document.document_type),
          fileName: document.file_name,
          storagePath: document.file_path,
          mimeType: mimeFromFileName(document.file_name),
          signedUrl: null,
        })),
        history: historyRows,
      },
      error: null,
    };
  } catch (error) {
    console.error("[claim-review] claim loading exception:", safeErrorDetails(error));
    return { claim: null, error: "Unable to load this claim due to a server error." };
  }
}

export async function getAuthorizedClaimDocument(params: {
  claimId: string;
  documentId: string;
}): Promise<{ filePath: string; fileName: string } | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("claim_documents")
    .select("file_path, file_name")
    .eq("id", params.documentId)
    .eq("claim_id", params.claimId)
    .maybeSingle();
  if (error || !data) return null;
  return { filePath: data.file_path, fileName: data.file_name };
}
