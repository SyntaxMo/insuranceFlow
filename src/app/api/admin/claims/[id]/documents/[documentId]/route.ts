import { NextResponse } from "next/server";
import { getStaffForApi } from "@/lib/auth/session";
import { getAuthorizedClaimDocument } from "@/lib/claims/admin";
import { createServiceRoleClient, getStorageBucket } from "@/lib/supabase/server";

const SIGNED_URL_SECONDS = 180;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const staff = await getStaffForApi();
  if (!staff) {
    return NextResponse.json({ error: "You are not authorized to access claim evidence." }, { status: 403 });
  }
  const { id, documentId } = await context.params;
  const document = await getAuthorizedClaimDocument({ claimId: id, documentId });
  if (!document) {
    return NextResponse.json({ error: "Claim document unavailable." }, { status: 404 });
  }
  const supabase = createServiceRoleClient();
  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await supabase.storage
    .from(getStorageBucket())
    .createSignedUrl(document.filePath, SIGNED_URL_SECONDS, download
      ? { download: document.fileName }
      : undefined);
  if (error || !data?.signedUrl) {
    console.error("Claim document signed URL failed:", { claimId: id, documentId });
    return NextResponse.json({ error: "Claim document unavailable." }, { status: 503 });
  }
  return NextResponse.redirect(data.signedUrl, 307);
}
