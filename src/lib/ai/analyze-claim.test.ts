import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaimByIdMock, getSavedClaimAnalysisMock, openRouterConstructorMock, openRouterSendMock, prepareClaimDocumentsMock, saveClaimAnalysisMock } = vi.hoisted(() => ({
  getClaimByIdMock: vi.fn(),
  getSavedClaimAnalysisMock: vi.fn(),
  openRouterConstructorMock: vi.fn(),
  openRouterSendMock: vi.fn(),
  prepareClaimDocumentsMock: vi.fn(),
  saveClaimAnalysisMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@openrouter/sdk", () => ({
  OpenRouter: class OpenRouterMock {
    chat = { send: openRouterSendMock };
    constructor(options: unknown) { openRouterConstructorMock(options); }
  },
}));
vi.mock("@/lib/claims/admin", () => ({ getClaimById: getClaimByIdMock }));
vi.mock("@/lib/ai/documents", () => ({ prepareClaimDocuments: prepareClaimDocumentsMock }));
vi.mock("@/lib/ai/store", () => ({
  getSavedClaimAnalysis: getSavedClaimAnalysisMock,
  saveClaimAnalysis: saveClaimAnalysisMock,
}));

import { analyzeClaimWithOpenRouter } from "@/lib/ai/analyze-claim";
import { ClaimAnalysisError } from "@/lib/ai/errors";
import type { ClaimAnalysisResult } from "@/types/ai-analysis";

const savedAnalysis: ClaimAnalysisResult = {
  summary: "Saved analysis",
  extractedInformation: { accidentDate: null, accidentLocation: null, vehicle: null, repairEstimateAmount: null, policeReportNumber: null, policeReportDetails: null, visibleVehicleDamage: [], otherVehiclesMentioned: [], otherPartiesMentioned: [] },
  missingInformation: [], inconsistencies: [], riskFlags: [], model: "claim-model", updatedAt: "2026-09-16T10:00:00Z",
};

const claim = {
  id: "claim-1", claimNumber: "CLM-1", accidentDate: "2026-09-16", accidentLocation: "Manama", description: "Rear impact", documents: [],
  policy: { policyNumber: "MOT-1", coverageType: "COMPREHENSIVE", excessAmount: 150, coverageLimit: 9_500, vehicle: { make: "Toyota", model: "Corolla", year: 2026, plateNumber: "927410" } },
};

const validPayload = {
  summary: "The claim describes a rear impact.",
  extractedInformation: { accidentDate: "2026-09-16", accidentLocation: "Manama", vehicle: "Toyota Corolla (2026)", repairEstimateAmount: null, policeReportNumber: null, policeReportDetails: null, visibleVehicleDamage: ["Rear bumper"], otherVehiclesMentioned: [], otherPartiesMentioned: [] },
  missingInformation: [], inconsistencies: [], riskFlags: [],
};

const providerResponse = (payload: unknown = validPayload) => ({ choices: [{ message: { content: JSON.stringify(payload) } }] });
const capacityError = () => Object.assign(new Error("Response validation failed"), {
  name: "ResponseValidationError", statusCode: 200,
  body: JSON.stringify({ id: "gen-safe-id", error: { message: "Upstream capacity error", code: 502, metadata: { error_type: "provider_unavailable" } } }),
});
const timeoutError = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

describe("analyzeClaimWithOpenRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "test-key";
    getSavedClaimAnalysisMock.mockResolvedValue(null);
    getClaimByIdMock.mockResolvedValue({ claim, error: null });
    prepareClaimDocumentsMock.mockResolvedValue([]);
    saveClaimAnalysisMock.mockImplementation(async (_claimId: string, analysis: ClaimAnalysisResult) => analysis);
  });

  it("returns a completed persisted analysis without calling OpenRouter", async () => {
    getSavedClaimAnalysisMock.mockResolvedValue(savedAnalysis);
    await expect(analyzeClaimWithOpenRouter("claim-1")).resolves.toEqual(savedAnalysis);
    expect(openRouterConstructorMock).not.toHaveBeenCalled();
    expect(openRouterSendMock).not.toHaveBeenCalled();
  });

  it("persists a successful new analysis", async () => {
    openRouterSendMock.mockResolvedValue(providerResponse());
    const result = await analyzeClaimWithOpenRouter("claim-1");
    expect(result.summary).toBe(validPayload.summary);
    expect(openRouterSendMock).toHaveBeenCalledTimes(1);
    expect(saveClaimAnalysisMock).toHaveBeenCalledWith("claim-1", expect.objectContaining({ summary: validPayload.summary }));
  });

  it("retries a transient provider-capacity failure once and then succeeds", async () => {
    openRouterSendMock.mockRejectedValueOnce(capacityError()).mockResolvedValueOnce(providerResponse());
    await expect(analyzeClaimWithOpenRouter("claim-1")).resolves.toEqual(expect.objectContaining({ summary: validPayload.summary }));
    expect(openRouterSendMock).toHaveBeenCalledTimes(2);
    expect(saveClaimAnalysisMock).toHaveBeenCalledTimes(1);
  });

  it("stops after one retry when provider capacity remains exhausted", async () => {
    openRouterSendMock.mockRejectedValue(capacityError());
    await expect(analyzeClaimWithOpenRouter("claim-1")).rejects.toMatchObject({ category: "PROVIDER_CAPACITY", status: 503 });
    expect(openRouterSendMock).toHaveBeenCalledTimes(2);
    expect(saveClaimAnalysisMock).not.toHaveBeenCalled();
  });

  it("classifies provider timeout safely without retrying it", async () => {
    openRouterSendMock.mockRejectedValue(timeoutError());
    await expect(analyzeClaimWithOpenRouter("claim-1")).rejects.toMatchObject({ category: "PROVIDER_TIMEOUT", status: 504 });
    expect(openRouterSendMock).toHaveBeenCalledTimes(1);
    expect(saveClaimAnalysisMock).not.toHaveBeenCalled();
  });

  it("handles a malformed provider result without persisting it", async () => {
    openRouterSendMock.mockResolvedValue(providerResponse({ summary: "Incomplete" }));
    await expect(analyzeClaimWithOpenRouter("claim-1")).rejects.toEqual(expect.objectContaining<Partial<ClaimAnalysisError>>({ category: "INVALID_MODEL_RESPONSE", status: 502 }));
    expect(openRouterSendMock).toHaveBeenCalledTimes(1);
    expect(saveClaimAnalysisMock).not.toHaveBeenCalled();
  });
});
