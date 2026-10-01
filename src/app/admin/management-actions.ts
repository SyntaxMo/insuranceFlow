"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminForApi } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ManagementState } from "@/lib/admin/types";

const transitionSchema = z.object({ requestId: z.uuid(), action: z.enum(["process", "reject", "complete"]), note: z.string().trim().max(2000, "Use 2,000 characters or fewer."), confirmed: z.literal("on", { error: "Confirm this action before continuing." }) }).superRefine((value, ctx) => {
  if (value.action !== "process" && !value.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Enter a short resolution note." });
});
const staffSchema = z.object({ staffId: z.uuid(), fullName: z.string().trim().min(1, "Enter the staff member’s full name.").max(100, "Use 100 characters or fewer."), email: z.string().trim().toLowerCase().max(254).email("Enter a valid work email."), confirmed: z.literal("on", { error: "Confirm that these are authorized organization-managed account details." }) });

export async function transitionDeletionRequestAction(_previous: ManagementState, form: FormData): Promise<ManagementState> {
  try {
    const admin = await getAdminForApi();
    if (admin?.role !== "ADMIN") return { message: "Administrator access is required." };
    const parsed = transitionSchema.safeParse({ requestId: form.get("requestId"), action: form.get("action"), note: form.get("note") ?? "", confirmed: form.get("confirmed") });
    if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors, message: "Check the action details and confirmation." };
    const { requestId, action, note } = parsed.data;
    const now = new Date().toISOString();
    const status = action === "process" ? "PROCESSING" : action === "reject" ? "REJECTED" : "COMPLETED";
    // Compare-and-set: cancellation and administration cannot both win a race.
    const { data, error } = await createServiceRoleClient().from("data_deletion_requests")
      .update({ status, updated_at: now, resolved_at: action === "process" ? null : now, resolution_note: action === "process" ? null : note })
      .eq("id", requestId).eq("status", action === "complete" ? "PROCESSING" : "PENDING").select("id").maybeSingle();
    if (error || !data) return { message: "The request could not be updated. Refresh to check its current status." };
    revalidatePath("/admin/deletion-requests"); revalidatePath("/admin"); revalidatePath("/dashboard/settings");
    return { success: true, message: action === "complete" ? "Request marked completed. No account data was deleted." : action === "reject" ? "Request rejected." : "Request is now processing." };
  } catch {
    console.error("Deletion request administration failed:", { category: "unavailable" });
    return { message: "We could not update the request. Please try again." };
  }
}

export async function updateClaimsOfficerAction(_previous: ManagementState, form: FormData): Promise<ManagementState> {
  try {
    const admin = await getAdminForApi();
    if (admin?.role !== "ADMIN") return { message: "Administrator access is required." };
    const parsed = staffSchema.safeParse({ staffId: form.get("staffId"), fullName: form.get("fullName"), email: form.get("email"), confirmed: form.get("confirmed") });
    if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors, message: "Check the staff details and confirmation." };
    const { staffId, fullName, email } = parsed.data;
    const client = createServiceRoleClient();
    const target = await client.from("users").select("id, auth_user_id, full_name, email, role").eq("id", staffId).eq("role", "CLAIMS_OFFICER").maybeSingle();
    if (target.error || !target.data?.auth_user_id || target.data.role !== "CLAIMS_OFFICER") return { message: "This staff account is unavailable." };
    const authId = target.data.auth_user_id;
    const auth = await client.auth.admin.getUserById(authId);
    if (auth.error || auth.data.user?.id !== authId || !auth.data.user.email) return { message: "This staff account is unavailable." };
    const emailChanged = email !== auth.data.user.email.trim().toLowerCase();
    if (emailChanged) {
      // Auth changes first; never create a profile-only login identity.
      const updated = await client.auth.admin.updateUserById(authId, { email, email_confirm: true, user_metadata: { full_name: fullName } });
      if (updated.error || updated.data.user?.id !== authId || updated.data.user.email?.toLowerCase() !== email) return { message: "We could not update the work email. Check the address and try again." };
    }
    const profile = await client.from("users").update({ full_name: fullName, email }).eq("id", staffId).eq("auth_user_id", authId).eq("role", "CLAIMS_OFFICER").select("id").maybeSingle();
    if (profile.error || !profile.data) {
      // Trusted Auth email is reconciled on the staff member's next authenticated request.
      console.error("Staff profile update failed:", { category: "profile" });
      revalidatePath("/admin/claims-officers"); revalidatePath("/", "layout");
      return { message: emailChanged ? "The work email changed, but the profile update could not finish. Refresh and retry the name update." : "We could not update the staff details. Please try again." };
    }
    if (!emailChanged) {
      try {
        const metadata = await client.auth.admin.updateUserById(authId, { user_metadata: { full_name: fullName } });
        if (metadata.error) console.error("Staff display name synchronization failed:", { category: "metadata" });
      } catch { console.error("Staff display name synchronization failed:", { category: "metadata" }); }
    }
    revalidatePath("/", "layout"); revalidatePath("/admin/claims-officers"); revalidatePath("/admin/profile");
    return { success: true, message: "Staff account details updated." };
  } catch {
    console.error("Staff account administration failed:", { category: "unavailable" });
    return { message: "We could not update the staff details. Refresh and try again." };
  }
}
