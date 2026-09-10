import { describe, expect, it } from "vitest";
import { statusLabel, statusTone } from "@/lib/format";

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
});
