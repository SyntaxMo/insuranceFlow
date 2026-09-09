import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateClaimNumber } from "@/lib/claims/claim-number";

export { generateClaimNumber } from "@/lib/claims/claim-number";

export async function createUniqueClaimNumber(
  maxAttempts = 8,
): Promise<string> {
  const supabase = createServiceRoleClient();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateClaimNumber();
    const { data, error } = await supabase
      .from("claims")
      .select("id")
      .eq("claim_number", candidate)
      .maybeSingle();

    if (error) {
      console.error("Claim number uniqueness check failed:", error.message);
      return candidate;
    }

    if (!data) {
      return candidate;
    }
  }

  return `CLM-${Date.now()}`;
}
