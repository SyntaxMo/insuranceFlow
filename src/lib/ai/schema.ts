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
  .optional()
  .transform((value) => emptyToNull(value ?? null));

const stringList = z
  .array(z.unknown())
  .optional()
  .transform((values) =>
    (values ?? []).flatMap((item) => {
      if (typeof item === "string" || typeof item === "number") {
        const text = String(item).trim();
        return text ? [text] : [];
      }
      return [];
    }),
  );

const repairEstimateAmount = z
  .union([z.number(), z.string(), z.null()])
  .optional()
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
  extractedInformation: z
    .object({
      accidentDate: stringOrNull,
      accidentLocation: stringOrNull,
      vehicle: stringOrNull,
      repairEstimateAmount,
      policeReportNumber: stringOrNull,
      policeReportDetails: stringOrNull,
      visibleVehicleDamage: stringList,
      otherVehiclesMentioned: stringList,
      otherPartiesMentioned: stringList,
    })
    .optional()
    .transform((value) => ({
      accidentDate: value?.accidentDate ?? null,
      accidentLocation: value?.accidentLocation ?? null,
      vehicle: value?.vehicle ?? null,
      repairEstimateAmount: value?.repairEstimateAmount ?? null,
      policeReportNumber: value?.policeReportNumber ?? null,
      policeReportDetails: value?.policeReportDetails ?? null,
      visibleVehicleDamage: value?.visibleVehicleDamage ?? [],
      otherVehiclesMentioned: value?.otherVehiclesMentioned ?? [],
      otherPartiesMentioned: value?.otherPartiesMentioned ?? [],
    })),
  missingInformation: stringList,
  inconsistencies: stringList,
  riskFlags: stringList,
});

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

  console.error("AI JSON parse failed:", lastError);
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
    console.error("AI schema validation failed:", parsed.error.issues);
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
