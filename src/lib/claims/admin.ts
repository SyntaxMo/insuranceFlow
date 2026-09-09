import "server-only";

import {
  createServiceRoleClient,
  getStorageBucket,
} from "@/lib/supabase/server";
import { mapPolicyToSummary } from "@/lib/claims/policy-eligibility";
import type {
  Claim,
  ClaimDetailView,
  ClaimDocument,
  ClaimListItem,
  Policy,
} from "@/types/database";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function vehicleLabel(policy: Policy | null): string {
  const vehicle = asSingle(policy?.vehicles);
  if (!vehicle) return "Unknown vehicle";
  return `${vehicle.make} ${vehicle.model} (${vehicle.year})`;
}

export async function listClaims(): Promise<{
  claims: ClaimListItem[];
  error: string | null;
}> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("claims")
      .select(
        `
        id,
        claim_number,
        accident_date,
        status,
        created_at,
        policies (
          policy_number,
          vehicles (
            make,
            model,
            year,
            plate_number
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listClaims failed:", error.message);
      return {
        claims: [],
        error: "Unable to load claims right now. Please try again shortly.",
      };
    }

    const claims: ClaimListItem[] = (data || []).map((row) => {
      const claim = row as Claim;
      const policy = asSingle(claim.policies);
      return {
        id: claim.id,
        claimNumber: claim.claim_number,
        policyNumber: policy?.policy_number || "—",
        vehicleLabel: vehicleLabel(policy),
        accidentDate: claim.accident_date,
        status: String(claim.status),
        createdAt: claim.created_at,
      };
    });

    return { claims, error: null };
  } catch (err) {
    console.error("listClaims exception:", err);
    return {
      claims: [],
      error: "Unable to load claims due to a server error.",
    };
  }
}

export async function getClaimById(
  id: string,
): Promise<{ claim: ClaimDetailView | null; error: string | null }> {
  try {
    const supabase = createServiceRoleClient();
    const bucket = getStorageBucket();

    const { data, error } = await supabase
      .from("claims")
      .select(
        `
        id,
        claim_number,
        accident_date,
        accident_location,
        description,
        contact_email,
        contact_phone,
        status,
        created_at,
        policy_id,
        policies (
          id,
          user_id,
          vehicle_id,
          policy_number,
          status,
          start_date,
          end_date,
          coverage_type,
          excess_amount,
          coverage_limit,
          vehicles (
            id,
            owner_id,
            make,
            model,
            year,
            plate_number
          )
        )
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("getClaimById failed:", error.message);
      return {
        claim: null,
        error: "Unable to load this claim right now. Please try again shortly.",
      };
    }

    if (!data) {
      return { claim: null, error: "Claim not found." };
    }

    const claim = data as Claim;
    const policy = asSingle(claim.policies);
    if (!policy) {
      return { claim: null, error: "Claim is missing policy details." };
    }

    const summary = mapPolicyToSummary(policy);
    if (!summary) {
      return { claim: null, error: "Claim is missing vehicle details." };
    }

    const { data: docs, error: docsError } = await supabase
      .from("claim_documents")
      .select(
        "id, claim_id, document_type, file_name, file_path, created_at",
      )
      .eq("claim_id", claim.id)
      .order("created_at", { ascending: true });

    if (docsError) {
      console.error("claim documents fetch failed:", docsError.message);
      return {
        claim: null,
        error: "Unable to load claim documents right now.",
      };
    }

    const documents = await Promise.all(
      ((docs || []) as ClaimDocument[]).map(async (doc) => {
        const { data: signed, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(doc.file_path, SIGNED_URL_TTL_SECONDS);

        if (signedError) {
          console.error("Signed URL failed:", signedError.message);
        }

        return {
          id: doc.id,
          documentType: String(doc.document_type),
          fileName: doc.file_name,
          storagePath: doc.file_path,
          mimeType: null,
          signedUrl: signed?.signedUrl || null,
        };
      }),
    );

    return {
      claim: {
        id: claim.id,
        claimNumber: claim.claim_number,
        status: String(claim.status),
        createdAt: claim.created_at,
        accidentDate: claim.accident_date,
        accidentLocation: claim.accident_location,
        description: claim.description,
        email: claim.contact_email || "",
        phone: claim.contact_phone || "",
        policyStatus: String(policy.status),
        policy: summary,
        documents,
      },
      error: null,
    };
  } catch (err) {
    console.error("getClaimById exception:", err);
    return {
      claim: null,
      error: "Unable to load this claim due to a server error.",
    };
  }
}
