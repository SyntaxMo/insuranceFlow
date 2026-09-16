import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getStaffForApi } from "@/lib/auth/session";
import { runOfficerClaimAction } from "@/lib/claims/workflow-server";
import { isOfficerClaimAction } from "@/lib/claims/workflow";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staff = await getStaffForApi();
  if (!staff) {
    return NextResponse.json({ error: "You are not authorized to update claims." }, { status: 403 });
  }

  let body: { action?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Check the action details and try again." }, { status: 400 });
  }
  if (!isOfficerClaimAction(body.action)) {
    return NextResponse.json({ error: "This claim action is not supported." }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await runOfficerClaimAction({
    claimId: id,
    action: body.action,
    note: body.note,
    staff,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  revalidatePath("/admin/claims");
  revalidatePath(`/admin/claims/${id}`);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/claims/${id}`);
  return NextResponse.json({ ok: true, emailDelivered: result.emailDelivered ?? null });
}
