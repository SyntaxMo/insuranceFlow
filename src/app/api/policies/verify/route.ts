import { NextResponse } from "next/server";
import { verifyPolicyByNumber } from "@/lib/claims/policy";
import { getAuthenticatedProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Sign in to verify a policy.", code: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (profile.role !== "CUSTOMER") {
      return NextResponse.json({ ok: false, error: "Only customers can verify policies.", code: "FORBIDDEN" }, { status: 403 });
    }
    const body = (await request.json()) as { policyNumber?: string };
    const result = await verifyPolicyByNumber(body.policyNumber || "", profile.id);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code },
        { status: result.code === "SERVER" ? 502 : 400 },
      );
    }

    return NextResponse.json({ ok: true, policy: result.policy });
  } catch (err) {
    console.error("POST /api/policies/verify failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "We could not verify this policy right now. Please try again shortly.",
        code: "SERVER",
      },
      { status: 500 },
    );
  }
}
