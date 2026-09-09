import { z } from "zod";
import { ClaimAnalysisError } from "@/lib/ai/errors";
import type { ClaimAnalysisResult } from "@/types/ai-analysis";
import { CLAIM_AI_MODEL } from "@/types/ai-analysis";

const emptyToNull = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const stringOrNull = z
  .union([z.string(), z.null()])
  .transform((value) => emptyToNull(value));

const stringList = z
  .array(z.string())
  .transform((values) => values.map((item) => item.trim()).filter(Boolean));

const repairEstimateAmount = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => {
    if (value == null || value === "") return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  });

export const claimAnalysisPayloadSchema = z.object({
  summary: z.string().min(1),
  extractedInformation: z.object({
      accidentDate: stringOrNull,
      accidentLocation: stringOrNull,
      vehicle: stringOrNull,
      repairEstimateAmount,
      policeReportNumber: stringOrNull,
      policeReportDetails: stringOrNull,
      visibleVehicleDamage: stringList,
      otherVehiclesMentioned: stringList,
      otherPartiesMentioned: stringList,
    }).strict(),
  missingInformation: stringList,
  inconsistencies: stringList,
  riskFlags: stringList,
}).strict();

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ClaimAnalysisError("The AI returned an empty response.", 502);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  const attempts = [candidate];
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    attempts.push(candidate.slice(start, end + 1));
  }

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (err) {
      lastError = err;
    }
  }

  console.error("[claim-analysis] JSON parse failed:",
    lastError instanceof Error
      ? { name: lastError.name, message: lastError.message }
      : { message: String(lastError) },
  );
  throw new ClaimAnalysisError(
    "The AI response was not valid JSON. Please try again.",
    502,
  );
}

export function parseClaimAnalysis(
  payload: unknown,
  meta?: { model?: string; updatedAt?: string | null },
): ClaimAnalysisResult {
  const parsed = claimAnalysisPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("[claim-analysis] schema validation failed:", parsed.error.issues);
    throw new ClaimAnalysisError(
      "The AI response could not be validated. Please try again.",
      502,
    );
  }

  return {
    summary: parsed.data.summary.trim(),
    extractedInformation: parsed.data.extractedInformation,
    missingInformation: parsed.data.missingInformation,
    inconsistencies: parsed.data.inconsistencies,
    riskFlags: parsed.data.riskFlags,
    model: meta?.model || CLAIM_AI_MODEL,
    updatedAt: meta?.updatedAt ?? null,
  };
}
