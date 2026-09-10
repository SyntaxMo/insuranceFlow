import { NextResponse } from "next/server";
import { submitClaim } from "@/lib/claims/submit";
import { getAuthenticatedProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Sign in to submit a claim." }, { status: 401 });
    }
    if (profile.role !== "CUSTOMER") {
      return NextResponse.json({ ok: false, error: "Only customers can submit claims." }, { status: 403 });
    }
    const formData = await request.formData();
    const result = await submitClaim(formData, profile);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || "Claim submission failed." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      claimNumber: result.claimNumber,
    });
  } catch (err) {
    console.error("POST /api/claims failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "We could not submit your claim right now. Please try again shortly.",
      },
      { status: 500 },
    );
  }
}
