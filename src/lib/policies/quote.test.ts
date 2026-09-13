import { describe, expect, it } from "vitest";
import { calculateDemoQuote } from "@/lib/policies/quote";

describe("calculateDemoQuote", () => {
  it("calculates a deterministic comprehensive quote", () => {
    const input = { coverage: "COMPREHENSIVE" as const, estimatedVehicleValue: 10_000, vehicleYear: 2024, currentYear: 2026 };
    expect(calculateDemoQuote(input)).toEqual(calculateDemoQuote(input));
    expect(calculateDemoQuote(input)).toMatchObject({ annualPremium: 180, excess: 150, coverageLimit: 10_000 });
  });

  it("applies comprehensive age adjustments and premium bounds", () => {
    expect(calculateDemoQuote({ coverage: "COMPREHENSIVE", estimatedVehicleValue: 1_000, vehicleYear: 2026, currentYear: 2026 }).annualPremium).toBe(120);
    expect(calculateDemoQuote({ coverage: "COMPREHENSIVE", estimatedVehicleValue: 250_000, vehicleYear: 2010, currentYear: 2026 }).annualPremium).toBe(600);
    expect(calculateDemoQuote({ coverage: "COMPREHENSIVE", estimatedVehicleValue: 10_000, vehicleYear: 2018, currentYear: 2026 }).annualPremium).toBe(207);
  });

  it("calculates the third-party age additions", () => {
    expect(calculateDemoQuote({ coverage: "THIRD_PARTY", estimatedVehicleValue: 10_000, vehicleYear: 2024, currentYear: 2026 })).toMatchObject({ annualPremium: 75, excess: 0, coverageLimit: 100_000 });
    expect(calculateDemoQuote({ coverage: "THIRD_PARTY", estimatedVehicleValue: 10_000, vehicleYear: 2018, currentYear: 2026 }).annualPremium).toBe(85);
    expect(calculateDemoQuote({ coverage: "THIRD_PARTY", estimatedVehicleValue: 10_000, vehicleYear: 2010, currentYear: 2026 }).annualPremium).toBe(95);
  });
});
