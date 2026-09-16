import type { ClaimHistoryAction, ClaimStatus, UserRole } from "@/types/database";

export type OfficerClaimAction =
  | "start_review"
  | "return_to_new"
  | "request_more_info"
  | "approve"
  | "reject"
  | "close";

export type ClaimTransition = {
  toStatus: ClaimStatus;
  historyAction: ClaimHistoryAction;
};

const OFFICER_TRANSITIONS: Record<OfficerClaimAction, ClaimTransition> = {
  start_review: { toStatus: "UNDER_REVIEW", historyAction: "REVIEW_STARTED" },
  return_to_new: { toStatus: "SUBMITTED", historyAction: "REVIEW_RETURNED" },
  request_more_info: { toStatus: "MORE_INFO_REQUIRED", historyAction: "MORE_INFO_REQUESTED" },
  approve: { toStatus: "APPROVED", historyAction: "CLAIM_APPROVED" },
  reject: { toStatus: "REJECTED", historyAction: "CLAIM_REJECTED" },
  close: { toStatus: "CLOSED", historyAction: "CLAIM_CLOSED" },
};

const VALID_FROM: Record<OfficerClaimAction, ReadonlySet<ClaimStatus>> = {
  start_review: new Set(["SUBMITTED"]),
  return_to_new: new Set(["UNDER_REVIEW"]),
  request_more_info: new Set(["UNDER_REVIEW"]),
  approve: new Set(["UNDER_REVIEW"]),
  reject: new Set(["UNDER_REVIEW"]),
  close: new Set(["APPROVED", "REJECTED"]),
};

export function isStaffClaimRole(role: UserRole): boolean {
  return role === "CLAIMS_OFFICER" || role === "ADMIN";
}

export function isOfficerClaimAction(value: unknown): value is OfficerClaimAction {
  return typeof value === "string" && value in OFFICER_TRANSITIONS;
}

export function transitionForOfficerAction(
  action: OfficerClaimAction,
): ClaimTransition {
  return OFFICER_TRANSITIONS[action];
}

export function canRunOfficerAction(
  currentStatus: string,
  action: OfficerClaimAction,
): boolean {
  return VALID_FROM[action].has(currentStatus.trim().toUpperCase() as ClaimStatus);
}

export function validateActionNote(
  action: OfficerClaimAction,
  note: unknown,
): { note: string | null; error: string | null } {
  const normalized = typeof note === "string" ? note.trim() : "";
  if (normalized.length > 1000) {
    return { note: null, error: "Keep the message or note within 1,000 characters." };
  }
  if (action === "request_more_info" && !normalized) {
    return { note: null, error: "Explain what additional information is needed." };
  }
  if (action === "reject" && !normalized) {
    return { note: null, error: "Provide a clear reason for rejecting this claim." };
  }
  return { note: normalized || null, error: null };
}

export const CUSTOMER_VISIBLE_HISTORY_ACTIONS = new Set<ClaimHistoryAction>([
  "CLAIM_SUBMITTED",
  "STATUS_IMPORTED",
  "REVIEW_STARTED",
  "REVIEW_RETURNED",
  "MORE_INFO_REQUESTED",
  "CUSTOMER_INFO_SUBMITTED",
  "CLAIM_APPROVED",
  "CLAIM_REJECTED",
  "CLAIM_CLOSED",
]);

export function historyActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CLAIM_SUBMITTED: "Claim submitted",
    STATUS_IMPORTED: "Claim status recorded",
    REVIEW_STARTED: "Review started",
    REVIEW_RETURNED: "Returned to New",
    MORE_INFO_REQUESTED: "More information requested",
    CUSTOMER_INFO_SUBMITTED: "Customer submitted additional information",
    CLAIM_APPROVED: "Claim approved",
    CLAIM_REJECTED: "Claim rejected",
    CLAIM_CLOSED: "Claim closed",
  };
  return labels[action] || "Claim updated";
}
