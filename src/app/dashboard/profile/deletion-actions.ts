"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCustomerForApi } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { DATA_DELETION_STATUS_COLUMNS, toDataDeletionRequest } from "@/lib/privacy/data-deletion";
import { sendDataDeletionRequestEmail } from "@/lib/privacy/emails";
import type { DataDeletionActionState } from "@/lib/privacy/types";

const requestSchema = z.object({
  reason: z.string({ error: "Enter a text reason." }).trim().max(1000, "Reason must be 1,000 characters or fewer."),
  acknowledged: z.literal("on", { error: "Confirm that this is a request, not immediate deletion." }),
});
const cancellationSchema = z.object({ requestId: z.uuid(), confirmed: z.literal("on") });
const accessError = "Sign in to your customer account to manage a data deletion request.";

export async function submitDataDeletionRequestAction(
  _previous: DataDeletionActionState,
  formData: FormData,
): Promise<DataDeletionActionState> {
  const parsed = requestSchema.safeParse({ reason: formData.get("reason") ?? "", acknowledged: formData.get("acknowledged") });
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };

  try {
    const customer = await getCustomerForApi();
    if (!customer || customer.role !== "CUSTOMER") return { message: accessError };
    const client = createServiceRoleClient();
    const active = await client.from("data_deletion_requests").select("id, status")
      .eq("user_id", customer.id).in("status", ["PENDING", "PROCESSING"]).limit(1).maybeSingle();
    if (active.error) return { message: "We could not check your request status. Please try again." };
    if (active.data) return { message: active.data.status === "PROCESSING" ? "A data deletion request is already processing." : "A data deletion request is already pending." };
    const { data, error } = await client
      .from("data_deletion_requests")
      .insert({ user_id: customer.id, status: "PENDING", reason: parsed.data.reason || null })
      .select(DATA_DELETION_STATUS_COLUMNS)
      .single();

    // The active-status unique index backs up the application check during races.
    if (error?.code === "23505") {
      revalidatePath("/dashboard/settings");
      return { message: "A data deletion request is already active. Refresh Settings to check its status." };
    }
    if (error || !data) {
      console.error("Data deletion request submission failed:", { category: "database" });
      return { message: "We could not record your request. Please try again." };
    }

    const request = toDataDeletionRequest(data);
    let emailSent = false;
    try {
      emailSent = await sendDataDeletionRequestEmail({
        recipient: customer.email || "",
        customerName: customer.full_name,
        requestId: request.id,
      });
    } catch {
      console.error("Data deletion confirmation email failed:", { category: "delivery" });
    }
    // Email is best-effort; a recorded request must never be rolled back.
    revalidatePath("/dashboard/settings");
    revalidatePath("/admin/deletion-requests");
    revalidatePath("/admin");
    return { outcome: "received", request, emailSent };
  } catch {
    console.error("Data deletion request submission failed:", { category: "unavailable" });
    return { message: "We could not record your request. Please try again." };
  }
}

export async function cancelDataDeletionRequestAction(
  _previous: DataDeletionActionState,
  formData: FormData,
): Promise<DataDeletionActionState> {
  const parsed = cancellationSchema.safeParse({ requestId: formData.get("requestId"), confirmed: formData.get("confirmed") });
  if (!parsed.success) return { message: "Confirm cancellation of a valid request." };

  try {
    const customer = await getCustomerForApi();
    if (!customer || customer.role !== "CUSTOMER") return { message: accessError };
    const now = new Date().toISOString();
    const { data, error } = await createServiceRoleClient()
      .from("data_deletion_requests")
      .update({ status: "CANCELLED", updated_at: now, resolved_at: now })
      .eq("id", parsed.data.requestId)
      .eq("user_id", customer.id)
      .eq("status", "PENDING")
      .select(DATA_DELETION_STATUS_COLUMNS)
      .maybeSingle();

    revalidatePath("/dashboard/settings");
    revalidatePath("/admin/deletion-requests");
    revalidatePath("/admin");
    if (error || !data) return { message: "This request could not be cancelled. Refresh Settings to check its status." };
    return { outcome: "cancelled", request: toDataDeletionRequest(data) };
  } catch {
    console.error("Data deletion request cancellation failed:", { category: "unavailable" });
    return { message: "We could not cancel your request. Please try again." };
  }
}
