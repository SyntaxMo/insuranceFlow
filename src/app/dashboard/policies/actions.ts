"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCustomer } from "@/lib/auth/session";
import { unlinkCustomerPolicy } from "@/lib/policies/unlink";

export type RemovePolicyState = { message?: string };

const policyIdSchema = z.string().uuid();

export async function removeLinkedPolicyAction(
  _previous: RemovePolicyState,
  formData: FormData,
): Promise<RemovePolicyState> {
  const customer = await requireCustomer();
  const policyId = policyIdSchema.safeParse(formData.get("policyId"));
  if (!policyId.success) {
    return { message: "This policy could not be removed from your account." };
  }

  try {
    const result = await unlinkCustomerPolicy({
      portalUserId: customer.id,
      policyId: policyId.data,
    });
    if (!result.ok) {
      if (result.reason === "active_claim") {
        return { message: "This policy cannot be removed while it has an active claim." };
      }
      if (result.reason === "not_linked") {
        return { message: "This policy is no longer linked to your account." };
      }
      return { message: "We couldn't remove this policy right now. Please try again." };
    }
  } catch (error) {
    console.error(
      "Policy unlink exception:",
      error instanceof Error ? error.message : "Unknown server error",
    );
    return { message: "We couldn't remove this policy right now. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/policies/${policyId.data}`);
  redirect("/dashboard?policyRemoved=1");
}
