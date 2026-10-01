import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AdminRequest, ClaimsOfficerAccount } from "./types";
import type { DataDeletionStatus } from "@/lib/privacy/types";

export const ADMIN_PAGE_SIZE = 25;
export function adminPageNumber(value?: string) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 100_000 ? number : 1;
}
export async function getAdminOverview() {
  await requireAdmin();
  try {
  const client = createServiceRoleClient();
  const [requests, officers] = await Promise.all([
    client.from("data_deletion_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    client.from("users").select("id", { count: "exact", head: true }).eq("role", "CLAIMS_OFFICER"),
  ]);
  return { pending: requests.error ? null : requests.count ?? 0, officers: officers.error ? null : officers.count ?? 0 };
  } catch { return { pending: null, officers: null }; }
}
export async function listDeletionRequests(page: number) {
  await requireAdmin();
  try {
    const { data, error, count } = await createServiceRoleClient().from("data_deletion_requests")
      .select("id, status, reason, created_at, resolved_at, resolution_note, customer:users!user_id(full_name, email)", { count: "exact" })
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
    if (error) return { requests: [] as AdminRequest[], count: 0, error: "Deletion requests are temporarily unavailable." };
    const requests: AdminRequest[] = (data ?? []).map(row => {
      const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
      return { id: row.id, status: row.status as DataDeletionStatus, reason: row.reason, createdAt: row.created_at, resolvedAt: row.resolved_at, resolutionNote: row.resolution_note, customerName: customer?.full_name || "Customer", customerEmail: customer?.email || "Not available" };
    });
    return { requests, count: count ?? 0, error: null };
  } catch { return { requests: [] as AdminRequest[], count: 0, error: "Deletion requests are temporarily unavailable." }; }
}
export async function listClaimsOfficers(page: number) {
  await requireAdmin();
  try {
    const client = createServiceRoleClient();
    const { data, error, count } = await client.from("users").select("id, full_name, email, created_at, auth_user_id", { count: "exact" })
      .eq("role", "CLAIMS_OFFICER").order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
    if (error) return { officers: [] as ClaimsOfficerAccount[], count: 0, error: "Claims Officer accounts are temporarily unavailable." };
    // Auth is the login-email authority. Never send Auth mappings or metadata to the browser.
    const officers: ClaimsOfficerAccount[] = await Promise.all((data ?? []).map(async row => {
      if (!row.auth_user_id) throw new Error("Missing staff mapping");
      const auth = await client.auth.admin.getUserById(row.auth_user_id);
      if (auth.error || auth.data.user?.id !== row.auth_user_id || !auth.data.user.email) throw new Error("Staff identity unavailable");
      return { id: row.id, fullName: row.full_name || "Not provided", email: auth.data.user.email, createdAt: row.created_at };
    }));
    return { officers, count: count ?? 0, error: null };
  } catch { return { officers: [] as ClaimsOfficerAccount[], count: 0, error: "Claims Officer accounts are temporarily unavailable." }; }
}
