import { describe, expect, it } from "vitest";
import { evaluatePolicyEligibility } from "@/lib/claims/policy-eligibility";
import { generateClaimNumber } from "@/lib/claims/claim-number";
import {
  isAccidentFormValid,
  validateAccidentForm,
  validateDocuments,
  validateFile,
} from "@/lib/validation/claim";
import type { Policy } from "@/types/database";

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "policy-1",
    user_id: "user-1",
    vehicle_id: "vehicle-1",
    policy_number: "MOT-2026-0001",
    status: "ACTIVE",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    coverage_type: "Comprehensive",
    excess_amount: 500,
    coverage_limit: 50000,
    vehicles: {
      id: "vehicle-1",
      owner_id: "user-1",
      make: "Toyota",
      model: "Corolla",
      year: 2022,
      plate_number: "ABC-1234",
    },
    ...overrides,
  };
}

describe("policy eligibility", () => {
  it("accepts an active in-force policy", () => {
    const result = evaluatePolicyEligibility(makePolicy());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.policy.policyNumber).toBe("MOT-2026-0001");
      expect(result.policy.vehicle.make).toBe("Toyota");
    }
  });

  it("rejects inactive policies", () => {
    const result = evaluatePolicyEligibility(
      makePolicy({ status: "INACTIVE" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INACTIVE");
  });

  it("rejects expired policies", () => {
    const result = evaluatePolicyEligibility(
      makePolicy({
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("EXPIRED");
  });
});

describe("accident validation", () => {
  it("requires complete accident details", () => {
    const errors = validateAccidentForm({
      accidentDate: "",
      accidentLocation: "",
      description: "short",
      email: "bad",
      phone: "12",
    });
    expect(Object.keys(errors).length).toBeGreaterThan(0);
    expect(
      isAccidentFormValid({
        accidentDate: "2026-03-01",
        accidentLocation: "Main Street intersection",
        description: "Rear-ended at a red light",
        email: "driver@example.com",
        phone: "+1 555 0100",
      }),
    ).toBe(true);
  });
});

describe("document validation", () => {
  it("requires repair estimate and photos", () => {
    const errors = validateDocuments({
      policeReport: null,
      repairEstimate: null,
      accidentPhotos: [],
    });
    expect(errors.repairEstimate).toBeTruthy();
    expect(errors.accidentPhotos).toBeTruthy();
  });

  it("rejects unsupported file types", () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    expect(validateFile(file)).toMatch(/Unsupported/);
  });
});

describe("claim numbers", () => {
  it("generates CLM-YYYY-#### numbers", () => {
    expect(generateClaimNumber(new Date("2026-09-08"))).toMatch(
      /^CLM-2026-\d{4}$/,
    );
  });
});
