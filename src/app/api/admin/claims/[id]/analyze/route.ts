import { NextResponse } from "next/server";
import { analyzeClaimWithOpenRouter } from "@/lib/ai/analyze-claim";
import type { ClaimAnalysisInputMode } from "@/lib/ai/analyze-claim";
import { ClaimAnalysisError } from "@/lib/ai/errors";
import { getStaffForApi } from "@/lib/auth/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await getStaffForApi();
    if (!staff) {
      return NextResponse.json(
        { error: "You are not authorized to analyze claims." },
        { status: 403 },
      );
    }
    const { id } = await context.params;
    const requestedMode = new URL(request.url).searchParams.get("input");
    const inputMode: ClaimAnalysisInputMode =
      process.env.NODE_ENV === "development" &&
      (requestedMode === "text" ||
        requestedMode === "images" ||
        requestedMode === "pdfs")
        ? requestedMode
        : "all";
    const analysis = await analyzeClaimWithOpenRouter(id, inputMode);
    return NextResponse.json({ analysis });
  } catch (err) {
    if (err instanceof ClaimAnalysisError) {
      console.error("[claim-analysis] request failed safely:", {
        category: err.category,
        status: err.status,
      });
      return NextResponse.json(
        { error: "Unable to analyze this claim right now. Please try again." },
        { status: err.status },
      );
    }

    console.error("POST /api/admin/claims/[id]/analyze failed:", err);
    return NextResponse.json(
      { error: "Unable to analyze this claim right now." },
      { status: 500 },
    );
  }
}
