export interface ClaimAnalysisExtractedInformation {
  accidentDate: string | null;
  accidentLocation: string | null;
  vehicle: string | null;
  repairEstimateAmount: number | null;
  policeReportNumber: string | null;
  policeReportDetails: string | null;
  visibleVehicleDamage: string[];
  otherVehiclesMentioned: string[];
  otherPartiesMentioned: string[];
}

export interface ClaimAnalysisResult {
  summary: string;
  extractedInformation: ClaimAnalysisExtractedInformation;
  missingInformation: string[];
  inconsistencies: string[];
  riskFlags: string[];
  model: string;
  updatedAt: string | null;
}

export const CLAIM_AI_MODEL = "google/gemma-4-31b-it:free";
