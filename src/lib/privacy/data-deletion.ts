import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { DataDeletionRequest, DataDeletionStatus } from "./types";

export const DATA_DELETION_STATUS_COLUMNS = "id, status, created_at, updated_at, resolved_at";

type RequestRow = {
  id: string;
  status: DataDeletionStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export function toDataDeletionRequest(row: RequestRow): DataDeletionRequest {
  return { id: row.id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, resolvedAt: row.resolved_at };
}

/** Called only by trusted server loaders with the session-derived public.users ID. */
export async function getCustomerDataDeletionRequest(userId: string): Promise<{
  request: DataDeletionRequest | null;
  unavailable: boolean;
}> {
  try {
    const { data, error } = await createServiceRoleClient()
      .from("data_deletion_requests")
      .select(DATA_DELETION_STATUS_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Data deletion status lookup failed:", { category: "database" });
      return { request: null, unavailable: true };
    }
    return { request: data ? toDataDeletionRequest(data as RequestRow) : null, unavailable: false };
  } catch {
    console.error("Data deletion status lookup failed:", { category: "unavailable" });
    return { request: null, unavailable: true };
  }
}
