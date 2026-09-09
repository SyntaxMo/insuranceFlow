import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { ClaimAnalysisError, CLAIM_AI_ANALYSES_GRANT_SQL } from "@/lib/ai/errors";
import { parseClaimAnalysis } from "@/lib/ai/schema";
import type { ClaimAnalysisResult } from "@/types/ai-analysis";
import { CLAIM_AI_MODEL } from "@/types/ai-analysis";

interface ClaimAiAnalysisRow {
  id: string;
  claim_id: string;
  summary: string | null;
  extracted_information: unknown;
  missing_information: unknown;
  inconsistencies: unknown;
  risk_flags: unknown;
  model: string | null;
  created_at: string;
  updated_at: string | null;
}

function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("42501") ||
    lower.includes("not accept") ||
    lower.includes("schema cache")
  );
}

function throwStoreError(action: "read" | "write", message: string): never {
  console.error(`claim_ai_analyses ${action} failed:`, message);
  if (isPermissionError(message)) {
    throw new ClaimAnalysisError(
      "The AI analysis table exists, but this app cannot read or write it yet. Additional Supabase grants are required.",
      503,
      CLAIM_AI_ANALYSES_GRANT_SQL,
    );
  }
  throw new ClaimAnalysisError(
    action === "read"
      ? "Unable to load the saved AI analysis right now."
      : "Unable to save the AI analysis right now.",
    502,
  );
}

export async function getSavedClaimAnalysis(
  claimId: string,
): Promise<ClaimAnalysisResult | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("claim_ai_analyses")
      .select(
        "id, claim_id, summary, extracted_information, missing_information, inconsistencies, risk_flags, model, created_at, updated_at",
      )
      .eq("claim_id", claimId)
      .maybeSingle();

    if (error) {
      throwStoreError("read", error.message);
    }

    if (!data) return null;

    const row = data as ClaimAiAnalysisRow;
    return parseClaimAnalysis(
      {
        summary: row.summary || "",
        extractedInformation: row.extracted_information,
        missingInformation: row.missing_information,
        inconsistencies: row.inconsistencies,
        riskFlags: row.risk_flags,
      },
      {
        model: row.model || CLAIM_AI_MODEL,
        updatedAt: row.updated_at || row.created_at,
      },
    );
  } catch (err) {
    if (err instanceof ClaimAnalysisError) throw err;
    console.error("getSavedClaimAnalysis exception:", err);
    throw new ClaimAnalysisError("Unable to load the saved AI analysis right now.");
  }
}

export async function saveClaimAnalysis(
  claimId: string,
  analysis: ClaimAnalysisResult,
): Promise<ClaimAnalysisResult> {
  try {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("claim_ai_analyses")
      .upsert(
        {
          claim_id: claimId,
          summary: analysis.summary,
          extracted_information: analysis.extractedInformation,
          missing_information: analysis.missingInformation,
          inconsistencies: analysis.inconsistencies,
          risk_flags: analysis.riskFlags,
          model: CLAIM_AI_MODEL,
          updated_at: now,
        },
        { onConflict: "claim_id" },
      )
      .select(
        "id, claim_id, summary, extracted_information, missing_information, inconsistencies, risk_flags, model, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      throwStoreError("write", error?.message || "No row returned after upsert.");
    }

    const row = data as ClaimAiAnalysisRow;
    return {
      ...analysis,
      model: row.model || CLAIM_AI_MODEL,
      updatedAt: row.updated_at || now,
    };
  } catch (err) {
    if (err instanceof ClaimAnalysisError) throw err;
    console.error("saveClaimAnalysis exception:", err);
    throw new ClaimAnalysisError("Unable to save the AI analysis right now.");
  }
}
