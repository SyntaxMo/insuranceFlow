import { describe, expect, it } from "vitest";
import { formatCoverageType, formatCurrency, statusLabel, statusTone } from "@/lib/format";

describe("Bahraini dinar formatting", () => {
  it.each([
    [150, "BHD 150"],
    [12000, "BHD 12,000"],
    [184.5, "BHD 184.500"],
    [12.345, "BHD 12.345"],
  ])("formats %s as %s", (amount, expected) => {
    expect(formatCurrency(amount)).toBe(expected);
  });
});

describe("customer-facing coverage labels", () => {
  it.each([
    ["COMPREHENSIVE", "Comprehensive"],
    ["Comprehensive", "Comprehensive"],
    ["THIRD_PARTY", "Third Party"],
    ["Third Party", "Third Party"],
  ])("formats %s as %s", (coverage, expected) => {
    expect(formatCoverageType(coverage)).toBe(expected);
  });
});

describe("customer-facing statuses", () => {
  it.each([
    ["SUBMITTED", "Submitted"],
    ["UNDER_REVIEW", "Under review"],
    ["MORE_INFO_REQUIRED", "Action required"],
    ["APPROVED", "Approved"],
    ["REJECTED", "Rejected"],
  ])("maps %s to %s", (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });

  it("gives action-required claims a distinct readable tone", () => {
    expect(statusTone("MORE_INFO_REQUIRED")).toContain("orange");
  });

  it("gives active policies a clear success treatment", () => {
    expect(statusTone("ACTIVE")).toContain("emerald");
  });
});
