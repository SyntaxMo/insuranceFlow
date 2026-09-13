import { describe, expect, it } from "vitest";
import { policyPurchaseSchema, vehiclePurchaseSchema } from "@/lib/policies/purchase";

describe("vehicle purchase validation", () => {
  it("normalizes a valid vehicle", () => {
    const result = vehiclePurchaseSchema.parse({ make: " Toyota ", model: " Corolla ", year: "2024", plateNumber: " 123456 ", vin: " jtdkn3du0d1234567 ", estimatedVehicleValue: "10000" });
    expect(result).toMatchObject({ make: "Toyota", model: "Corolla", year: 2024, plateNumber: "123456", vin: "JTDKN3DU0D1234567", estimatedVehicleValue: 10_000 });
  });

  it.each(["12345", "123456", "  123456  "])("accepts Bahrain plate %j", (plateNumber) => {
    const result = vehiclePurchaseSchema.parse({ make: "Toyota", model: "Corolla", year: "2026", plateNumber, vin: "", estimatedVehicleValue: "9500" });
    expect(result.plateNumber).toBe(plateNumber.trim());
    expect(typeof result.plateNumber).toBe("string");
  });

  it.each(["1234", "1234567", "BH-12345", "BH12345", "ABC123", "12 3456", "12-3456", "12345A", "", "   "])("rejects invalid Bahrain plate %j", (plateNumber) => {
    const result = vehiclePurchaseSchema.safeParse({ make: "Toyota", model: "Corolla", year: "2026", plateNumber, vin: "", estimatedVehicleValue: "9500" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((issue) => issue.path[0] === "plateNumber")?.message).toBe("Enter a valid Bahrain plate number using 5 or 6 digits.");
    }
  });

  it("rejects invalid years, VINs, and demo values", () => {
    const result = vehiclePurchaseSchema.safeParse({ make: "Toyota", model: "Corolla", year: "1900", plateNumber: "12345", vin: "short", estimatedVehicleValue: "0" });
    expect(result.success).toBe(false);
  });

  it("requires a server idempotency token and known coverage", () => {
    const result = policyPurchaseSchema.safeParse({ make: "Toyota", model: "Corolla", year: "2024", plateNumber: "12345", vin: "", estimatedVehicleValue: "10000", coverage: "UNKNOWN", requestId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
