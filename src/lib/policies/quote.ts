import { formatCoverageType } from "@/lib/format";

export const COVERAGE_OPTIONS = ["COMPREHENSIVE", "THIRD_PARTY"] as const;
export type DemoCoverage = (typeof COVERAGE_OPTIONS)[number];

export type DemoQuote = {
  coverage: DemoCoverage;
  coverageLabel: string;
  annualPremium: number;
  excess: number;
  coverageLimit: number;
  vehicleAge: number;
  adjustmentLabel: string;
};

function roundBhd(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** DEMO portfolio pricing rules only. These are not actuarial insurance rates. */
export function calculateDemoQuote({
  coverage,
  estimatedVehicleValue,
  vehicleYear,
  currentYear = new Date().getUTCFullYear(),
}: {
  coverage: DemoCoverage;
  estimatedVehicleValue: number;
  vehicleYear: number;
  currentYear?: number;
}): DemoQuote {
  const vehicleAge = Math.max(0, currentYear - vehicleYear);

  if (coverage === "COMPREHENSIVE") {
    const multiplier = vehicleAge <= 2 ? 1 : vehicleAge <= 5 ? 1.08 : vehicleAge <= 9 ? 1.15 : 1.25;
    return {
      coverage,
      coverageLabel: formatCoverageType(coverage),
      annualPremium: roundBhd(clamp(estimatedVehicleValue * 0.018 * multiplier, 120, 600)),
      excess: 150,
      coverageLimit: roundBhd(estimatedVehicleValue),
      vehicleAge,
      adjustmentLabel: `${multiplier.toFixed(2)}×`,
    };
  }

  const ageAddition = vehicleAge <= 5 ? 0 : vehicleAge <= 9 ? 10 : 20;
  return {
    coverage,
    coverageLabel: formatCoverageType(coverage),
    annualPremium: roundBhd(Math.min(120, 75 + ageAddition)),
    excess: 0,
    coverageLimit: 100_000,
    vehicleAge,
    adjustmentLabel: ageAddition === 0 ? "No age adjustment" : `BHD ${ageAddition} age adjustment`,
  };
}
