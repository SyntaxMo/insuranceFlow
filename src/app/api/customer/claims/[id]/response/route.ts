import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCustomerForApi } from "@/lib/auth/session";
import { submitCustomerClaimResponse } from "@/lib/claims/workflow-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomerForApi();
  if (!customer) {
    return NextResponse.json({ error: "Sign in as a customer to respond to this claim." }, { status: 401 });
  }
  const { id } = await context.params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Check your response and attachments." }, { status: 400 });
  }
  const result = await submitCustomerClaimResponse({ claimId: id, formData, customer });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/claims/${id}`);
  revalidatePath("/admin/claims");
  revalidatePath(`/admin/claims/${id}`);
  return NextResponse.json({ ok: true });
}
