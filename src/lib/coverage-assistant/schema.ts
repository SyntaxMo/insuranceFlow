import { z } from "zod";
import { COVERAGE_OPTIONS } from "@/lib/policies/quote";
import { MAX_VEHICLE_YEAR } from "@/lib/policies/purchase";

export const OWN_VEHICLE_PROTECTION_OPTIONS = [
  "VERY_IMPORTANT",
  "SOMEWHAT_IMPORTANT",
  "NOT_A_PRIORITY",
] as const;
export const COST_PREFERENCE_OPTIONS = [
  "BROADER_PROTECTION",
  "BALANCED",
  "LOWEST_COST",
] as const;
export const REPAIR_COST_COMFORT_OPTIONS = [
  "PREFER_INSURANCE_HELP",
  "CAN_HANDLE_SOME",
  "COMFORTABLE_SELF_FUNDING",
] as const;
export const PROTECTION_PRIORITY_OPTIONS = [
  "VEHICLE_AND_LIABILITY",
  "BALANCED",
  "MAINLY_LIABILITY",
] as const;
export const RISK_PREFERENCE_OPTIONS = [
  "STRONGER_PROTECTION",
  "BALANCED",
  "MORE_FINANCIAL_RISK",
] as const;

export const coverageAssistantInputSchema = z
  .object({
    vehicle: z
      .object({
        make: z.string().trim().min(1).max(60),
        model: z.string().trim().min(1).max(60),
        year: z.number().int().min(1980).max(MAX_VEHICLE_YEAR),
        estimatedValue: z.number().finite().min(1_000).max(250_000),
      })
      .strict(),
    preferences: z
      .object({
        ownVehicleProtection: z.enum(OWN_VEHICLE_PROTECTION_OPTIONS),
        costPreference: z.enum(COST_PREFERENCE_OPTIONS),
        repairCostComfort: z.enum(REPAIR_COST_COMFORT_OPTIONS),
        protectionPriority: z.enum(PROTECTION_PRIORITY_OPTIONS),
        riskPreference: z.enum(RISK_PREFERENCE_OPTIONS),
      })
      .strict(),
    optionalNote: z.string().trim().max(500).default(""),
  })
  .strict();

const conciseText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const coverageRecommendationSchema = z
  .object({
    recommendedCoverage: z.enum(COVERAGE_OPTIONS),
    headline: conciseText(1, 100),
    summary: conciseText(1, 320),
    reasons: z.array(conciseText(1, 160)).min(2).max(4),
    comparisonNote: conciseText(1, 260),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .strict();

export type CoverageAssistantInput = z.infer<typeof coverageAssistantInputSchema>;
export type CoverageRecommendation = z.infer<typeof coverageRecommendationSchema>;
export type CoveragePreferences = CoverageAssistantInput["preferences"];

