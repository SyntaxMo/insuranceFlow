import { describe, expect, it } from "vitest";
import { ClaimAnalysisError } from "@/lib/ai/errors";
import { extractJsonObject, parseClaimAnalysis } from "@/lib/ai/schema";

describe("extractJsonObject", () => {
  it("parses raw JSON", () => {
    expect(extractJsonObject('{"summary":"ok"}')).toEqual({ summary: "ok" });
  });

  it("extracts JSON from markdown fences", () => {
    const text = "```json\n{\"summary\":\"fenced\"}\n```";
    expect(extractJsonObject(text)).toEqual({ summary: "fenced" });
  });

  it("extracts JSON when extra text surrounds it", () => {
    expect(extractJsonObject('Here you go: {"summary":"wrapped"} thanks')).toEqual({
      summary: "wrapped",
    });
  });

  it("rejects empty responses", () => {
    expect(() => extractJsonObject("   ")).toThrow(ClaimAnalysisError);
  });

  it("rejects malformed JSON", () => {
    expect(() => extractJsonObject("not json")).toThrow(ClaimAnalysisError);
  });
});

describe("parseClaimAnalysis", () => {
  it("validates and fills omitted fields without inventing facts", () => {
    const result = parseClaimAnalysis({
      summary: "A rear-end collision was reported.",
      extractedInformation: {
        accidentDate: "2026-03-01",
        vehicle: "Toyota Corolla (2022)",
      },
    });

    expect(result.extractedInformation.accidentDate).toBe("2026-03-01");
    expect(result.extractedInformation.accidentLocation).toBeNull();
    expect(result.extractedInformation.repairEstimateAmount).toBeNull();
    expect(result.extractedInformation.policeReportNumber).toBeNull();
    expect(result.extractedInformation.visibleVehicleDamage).toEqual([]);
    expect(result.missingInformation).toEqual([]);
    expect(result.inconsistencies).toEqual([]);
    expect(result.riskFlags).toEqual([]);
  });

  it("rejects missing summaries", () => {
    expect(() => parseClaimAnalysis({ extractedInformation: {} })).toThrow(
      ClaimAnalysisError,
    );
  });
});
