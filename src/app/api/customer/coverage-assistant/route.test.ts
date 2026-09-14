import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCustomerForApiMock, recommendCoverageMock } = vi.hoisted(() => ({
  getCustomerForApiMock: vi.fn(),
  recommendCoverageMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCustomerForApi: getCustomerForApiMock }));
vi.mock("@/lib/coverage-assistant/recommend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/coverage-assistant/recommend")>();
  return { ...actual, recommendCoverage: recommendCoverageMock };
});

import { POST } from "@/app/api/customer/coverage-assistant/route";

const payload = {
  vehicle: { make: "Toyota", model: "Corolla", year: 2026, estimatedValue: 9500 },
  preferences: {
    ownVehicleProtection: "VERY_IMPORTANT",
    costPreference: "BROADER_PROTECTION",
    repairCostComfort: "PREFER_INSURANCE_HELP",
    protectionPriority: "VEHICLE_AND_LIABILITY",
    riskPreference: "STRONGER_PROTECTION",
  },
  optionalNote: "",
};

function request(body: unknown = payload) {
  return new Request("http://localhost/api/customer/coverage-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("coverage assistant API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomerForApiMock.mockResolvedValue({ id: "customer-id", role: "CUSTOMER" });
    recommendCoverageMock.mockResolvedValue({
      recommendedCoverage: "COMPREHENSIVE",
      headline: "Comprehensive may suit you better",
      summary: "Your answers favor broader protection.",
      reasons: ["Own-vehicle protection matters.", "You prefer help with repair costs."],
      comparisonNote: "Third Party mainly focuses on liability to others.",
      confidence: "high",
    });
  });

  it("requires an authenticated customer before processing input", async () => {
    getCustomerForApiMock.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(recommendCoverageMock).not.toHaveBeenCalled();
  });

  it("passes only a validated, fixed-shape payload to the assistant", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(recommendCoverageMock).toHaveBeenCalledWith(payload);
  });

  it("rejects malformed JSON safely", async () => {
    const response = await POST(new Request("http://localhost/api/customer/coverage-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Check your answers and try again." });
    expect(recommendCoverageMock).not.toHaveBeenCalled();
  });

  it.each([
    { ...payload, preferences: { ...payload.preferences, riskPreference: "UNSUPPORTED" } },
    { ...payload, vehicle: { ...payload.vehicle, year: 1900 } },
    { ...payload, optionalNote: "x".repeat(501) },
    { ...payload, model: "client-selected-model" },
  ])("rejects malformed or unexpected browser input", async (invalidPayload) => {
    const response = await POST(request(invalidPayload));
    expect(response.status).toBe(400);
    expect(recommendCoverageMock).not.toHaveBeenCalled();
  });
});
