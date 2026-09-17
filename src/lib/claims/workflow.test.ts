import { describe, expect, it } from "vitest";
import {
  canRunOfficerAction,
  historyActionLabel,
  transitionForOfficerAction,
  validateActionNote,
} from "@/lib/claims/workflow";

describe("claim workflow", () => {
  it.each([
    ["SUBMITTED", "start_review"],
    ["UNDER_REVIEW", "request_more_info"],
    ["UNDER_REVIEW", "approve"],
    ["UNDER_REVIEW", "reject"],
    ["APPROVED", "close"],
    ["REJECTED", "close"],
  ] as const)("allows %s via %s", (status, action) => {
    expect(canRunOfficerAction(status, action)).toBe(true);
  });

  it.each([
    ["SUBMITTED", "approve"],
    ["REJECTED", "approve"],
    ["UNDER_REVIEW", "close"],
  ] as const)("rejects %s via %s", (status, action) => {
    expect(canRunOfficerAction(status, action)).toBe(false);
  });

  it.each([
    "start_review",
    "request_more_info",
    "approve",
    "reject",
    "close",
  ] as const)("keeps closed claims immutable for %s", (action) => {
    expect(canRunOfficerAction("CLOSED", action)).toBe(false);
  });

  it("maps actions to the database transition contract", () => {
    expect(transitionForOfficerAction("request_more_info")).toEqual({
      toStatus: "MORE_INFO_REQUIRED",
      historyAction: "MORE_INFO_REQUESTED",
    });
  });

  it("retains the historical Return to New audit label", () => {
    expect(historyActionLabel("REVIEW_RETURNED")).toBe("Returned to New");
  });

  it("requires request and rejection messages but keeps approval notes optional", () => {
    expect(validateActionNote("request_more_info", "").error).toMatch(/needed/i);
    expect(validateActionNote("reject", "").error).toMatch(/reason/i);
    expect(validateActionNote("approve", "")).toEqual({ note: null, error: null });
  });

  it("provides readable audit labels", () => {
    expect(historyActionLabel("CUSTOMER_INFO_SUBMITTED")).toBe(
      "Customer submitted additional information",
    );
  });
});
