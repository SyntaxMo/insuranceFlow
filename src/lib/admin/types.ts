import type { DataDeletionStatus } from "@/lib/privacy/types";
export type AdminRequest = { id: string; status: DataDeletionStatus; createdAt: string; reason: string | null; resolvedAt: string | null; resolutionNote: string | null; customerName: string; customerEmail: string };
export type ClaimsOfficerAccount = { id: string; fullName: string; email: string; createdAt: string };
export type ManagementState = { success?: boolean; message?: string; fields?: { fullName?: string[]; email?: string[]; note?: string[]; confirmed?: string[] } };
