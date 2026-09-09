import { NextResponse } from "next/server";
import { analyzeClaimWithOpenRouter } from "@/lib/ai/analyze-claim";
import { ClaimAnalysisError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const analysis = await analyzeClaimWithOpenRouter(id);
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
