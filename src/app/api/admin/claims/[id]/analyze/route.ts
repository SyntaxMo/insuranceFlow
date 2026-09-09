import { NextResponse } from "next/server";
import { analyzeClaimWithOpenRouter } from "@/lib/ai/analyze-claim";
import type { ClaimAnalysisInputMode } from "@/lib/ai/analyze-claim";
import { ClaimAnalysisError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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
      return NextResponse.json(
        {
          error: err.message,
          ...(err.supabaseSql ? { setupSql: err.supabaseSql } : {}),
        },
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
