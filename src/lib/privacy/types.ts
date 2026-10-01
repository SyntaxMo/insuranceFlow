export type DataDeletionStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED";

/** Only customer-visible request state; excludes reasons and internal resolution notes. */
export type DataDeletionRequest = {
  id: string;
  status: DataDeletionStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type DataDeletionActionState = {
  outcome?: "received" | "cancelled";
  request?: DataDeletionRequest;
  emailSent?: boolean;
  message?: string;
  fields?: { reason?: string[]; acknowledged?: string[] };
};
