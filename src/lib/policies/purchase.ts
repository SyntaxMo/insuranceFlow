import { z } from "zod";
import { COVERAGE_OPTIONS } from "@/lib/policies/quote";

export const MAX_VEHICLE_YEAR = new Date().getUTCFullYear() + 1;

export function normalizePlate(value: string): string {
  return value.trim();
}

export function normalizeVin(value: string): string {
  return value.trim().replace(/[\s-]+/g, "").toUpperCase();
}

export const vehiclePurchaseSchema = z.object({
  make: z.string().trim().min(1, "Enter the vehicle make.").max(60, "Make must be 60 characters or fewer."),
  model: z.string().trim().min(1, "Enter the vehicle model.").max(60, "Model must be 60 characters or fewer."),
  year: z.coerce.number().int("Enter a valid year.").min(1980, "Enter a year from 1980 onwards.").max(MAX_VEHICLE_YEAR, `Year cannot be later than ${MAX_VEHICLE_YEAR}.`),
  plateNumber: z.string().transform(normalizePlate).pipe(z.string().regex(/^\d{5,6}$/, "Enter a valid Bahrain plate number using 5 or 6 digits.")),
  vin: z.string().transform(normalizeVin).pipe(z.union([z.literal(""), z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN must contain 17 valid characters.")])),
  estimatedVehicleValue: z.coerce.number().finite().min(1_000, "Vehicle value must be at least BHD 1,000.").max(250_000, "Vehicle value must not exceed BHD 250,000 for this demonstration."),
});

export const policyPurchaseSchema = vehiclePurchaseSchema.extend({
  coverage: z.enum(COVERAGE_OPTIONS, { error: "Choose a coverage option." }),
  requestId: z.string().uuid("Unable to identify this purchase request. Refresh and try again."),
  consentAccepted: z.literal("true", {
    error: "You must accept the Terms & Conditions before completing this simulated purchase.",
  }),
});

export const quoteRequestSchema = vehiclePurchaseSchema.extend({
  coverage: z.enum(COVERAGE_OPTIONS, { error: "Choose a coverage option." }),
});

export type VehiclePurchaseInput = z.infer<typeof vehiclePurchaseSchema>;
export type PolicyPurchaseInput = z.infer<typeof policyPurchaseSchema>;

export function flattenPurchaseErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  return fields;
}
