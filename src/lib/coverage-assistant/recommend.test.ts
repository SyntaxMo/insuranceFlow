import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, constructorMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  constructorMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@openrouter/sdk", () => ({
  OpenRouter: class {
    chat = { send: sendMock };
    constructor(options: unknown) {
      constructorMock(options);
    }
  },
}));

import {
  COVERAGE_ASSISTANT_MODEL,
  CoverageAssistantError,
  recommendCoverage,
} from "@/lib/coverage-assistant/recommend";

const input = {
  vehicle: { make: "Toyota", model: "Corolla", year: 2026, estimatedValue: 9500 },
  preferences: {
    ownVehicleProtection: "VERY_IMPORTANT" as const,
    costPreference: "BROADER_PROTECTION" as const,
    repairCostComfort: "PREFER_INSURANCE_HELP" as const,
    protectionPriority: "VEHICLE_AND_LIABILITY" as const,
    riskPreference: "STRONGER_PROTECTION" as const,
  },
  optionalNote: "I drive daily.",
};

const mixedInput = {
  vehicle: { make: "Toyota", model: "Corolla", year: 2026, estimatedValue: 9500 },
  preferences: {
    ownVehicleProtection: "VERY_IMPORTANT" as const,
    costPreference: "LOWEST_COST" as const,
    repairCostComfort: "CAN_HANDLE_SOME" as const,
    protectionPriority: "BALANCED" as const,
    riskPreference: "BALANCED" as const,
  },
  optionalNote: "",
};

function response(recommendedCoverage: "COMPREHENSIVE" | "THIRD_PARTY") {
  return {
    choices: [{ message: { content: JSON.stringify({
      recommendedCoverage,
      headline: `${recommendedCoverage === "COMPREHENSIVE" ? "Comprehensive" : "Third Party"} may suit you better`,
      summary: "Your answers point toward this simplified option.",
      reasons: ["It reflects your protection preference.", "It matches your comfort with repair costs."],
      comparisonNote: "The other option provides a different balance of own-vehicle protection and liability.",
      confidence: "medium",
    }) } }],
  };
}

describe("recommendCoverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  it.each(["COMPREHENSIVE", "THIRD_PARTY"] as const)("returns a validated %s recommendation", async (coverage) => {
    sendMock.mockResolvedValue(response(coverage));
    await expect(recommendCoverage(input)).resolves.toMatchObject({ recommendedCoverage: coverage });
    expect(constructorMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "test-openrouter-key", timeoutMs: 18_000 }));
    const request = sendMock.mock.calls[0][0].chatRequest;
    expect(request.model).toBe(COVERAGE_ASSISTANT_MODEL);
    expect(request.messages[0].content).toContain("Do not calculate");
    expect(request.messages[1].content).not.toContain("test-openrouter-key");
  });

  it("retries the exact mixed case once when OpenRouter wraps an upstream 502 in a successful HTTP response", async () => {
    const providerEnvelopeError = Object.assign(new Error("Response validation failed"), {
      name: "ResponseValidationError",
      statusCode: 200,
      rawValue: {
        id: "gen-mixed-provider-error",
        error: {
          code: 502,
          metadata: { error_type: "provider_unavailable" },
        },
      },
    });
    sendMock
      .mockRejectedValueOnce(providerEnvelopeError)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({
          recommendedCoverage: "COMPREHENSIVE",
          headline: "Comprehensive may still be the closer fit",
          summary: "Your priorities are mixed, but protecting your own vehicle remains important to you.",
          reasons: [
            "Protecting your own vehicle is very important to you.",
            "You also want to keep cost down and can handle some repair costs.",
          ],
          comparisonNote: "Third Party may better suit a stronger focus on lower cost and liability to others.",
          confidence: "low",
        }) } }],
      });

    await expect(recommendCoverage(mixedInput)).resolves.toMatchObject({
      recommendedCoverage: "COMPREHENSIVE",
      confidence: "low",
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("extracts a valid JSON object from markdown or explanatory text without weakening the schema", async () => {
    const valid = response("THIRD_PARTY").choices[0].message.content;
    sendMock.mockResolvedValue({
      choices: [{ message: { content: `Here is the result:\n\`\`\`json\n${valid}\n\`\`\`` } }],
    });
    await expect(recommendCoverage(mixedInput)).resolves.toMatchObject({
      recommendedCoverage: "THIRD_PARTY",
      confidence: "medium",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("uses one correction request when returned content is genuinely malformed", async () => {
    sendMock
      .mockResolvedValueOnce({ choices: [{ message: { content: "The recommendation is Comprehensive." } }] })
      .mockResolvedValueOnce(response("COMPREHENSIVE"));
    await expect(recommendCoverage(mixedInput)).resolves.toMatchObject({
      recommendedCoverage: "COMPREHENSIVE",
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
    const repairMessages = sendMock.mock.calls[1][0].chatRequest.messages;
    expect(repairMessages.at(-1).content).toContain("Correct the prior response");
  });

  it.each([
    ["malformed JSON", { choices: [{ message: { content: "not-json" } }] }],
    ["unsupported coverage", { choices: [{ message: { content: JSON.stringify({ ...response("COMPREHENSIVE").choices[0].message, recommendedCoverage: "HYBRID" }) } }] }],
    ["missing fields", { choices: [{ message: { content: '{"recommendedCoverage":"COMPREHENSIVE"}' } }] }],
  ])("rejects %s without returning raw output", async (_label, providerResponse) => {
    sendMock.mockResolvedValue(providerResponse);
    await expect(recommendCoverage(input)).rejects.toBeInstanceOf(CoverageAssistantError);
  });

  it("maps provider failures to a safe assistant error", async () => {
    sendMock.mockRejectedValue(new Error("provider secret detail"));
    await expect(recommendCoverage(input)).rejects.toMatchObject({
      message: "Coverage guidance is not available right now.",
      status: 502,
    });
  });

  it("stops after one retry when the provider remains unavailable", async () => {
    const unavailable = Object.assign(new Error("Response validation failed"), {
      name: "ResponseValidationError",
      rawValue: {
        id: "gen-provider-unavailable",
        error: { code: 502, metadata: { error_type: "provider_unavailable" } },
      },
    });
    sendMock.mockRejectedValue(unavailable);
    await expect(recommendCoverage(mixedInput)).rejects.toMatchObject({
      message: "Coverage guidance is not available right now.",
      status: 502,
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});
