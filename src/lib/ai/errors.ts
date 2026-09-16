import type { ClaimAnalysisFailureCategory } from "@/lib/ai/provider-errors";

export class ClaimAnalysisError extends Error {
  readonly status: number;
  readonly supabaseSql?: string;
  readonly category: ClaimAnalysisFailureCategory;

  constructor(
    message: string,
    status = 500,
    supabaseSql?: string,
    category: ClaimAnalysisFailureCategory = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "ClaimAnalysisError";
    this.status = status;
    this.supabaseSql = supabaseSql;
    this.category = category;
  }
}

export const CLAIM_AI_ANALYSES_GRANT_SQL = `grant select, insert, update, delete on table public.claim_ai_analyses to service_role;`;
