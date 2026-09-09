import { NextResponse } from "next/server";
import { submitClaim } from "@/lib/claims/submit";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await submitClaim(formData);

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
