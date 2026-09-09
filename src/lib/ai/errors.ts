export class ClaimAnalysisError extends Error {
  readonly status: number;
  readonly supabaseSql?: string;

  constructor(message: string, status = 500, supabaseSql?: string) {
    super(message);
    this.name = "ClaimAnalysisError";
    this.status = status;
    this.supabaseSql = supabaseSql;
  }
}

export const CLAIM_AI_ANALYSES_GRANT_SQL = `grant select, insert, update, delete on table public.claim_ai_analyses to service_role;`;
