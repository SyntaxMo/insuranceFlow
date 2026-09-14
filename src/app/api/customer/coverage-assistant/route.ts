import { NextResponse } from "next/server";
import { getCustomerForApi } from "@/lib/auth/session";
import { CoverageAssistantError, recommendCoverage } from "@/lib/coverage-assistant/recommend";
import { coverageAssistantInputSchema } from "@/lib/coverage-assistant/schema";

export const runtime = "nodejs";
export const maxDuration = 40;

export async function POST(request: Request) {
  const customer = await getCustomerForApi();
  if (!customer) {
    return NextResponse.json(
      { error: "Sign in as a customer to use coverage guidance." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Check your answers and try again." }, { status: 400 });
  }

  const parsed = coverageAssistantInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check your answers and try again." }, { status: 400 });
  }

  try {
    const recommendation = await recommendCoverage(parsed.data);
    return NextResponse.json({ recommendation });
  } catch (error) {
    if (error instanceof CoverageAssistantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/customer/coverage-assistant failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Coverage guidance is not available right now." },
      { status: 500 },
    );
  }
}

