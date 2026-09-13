import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase", "demo_policy_purchase.sql"), "utf8");

describe("demo policy purchase migration", () => {
  it("keeps issuance atomic and creates direct ownership", () => {
    expect(sql).toContain("insert into public.vehicles");
    expect(sql).toContain("values (p_portal_user_id");
    expect(sql).toContain("insert into public.policies");
    expect(sql).not.toContain("insert into public.customer_policy_links");
  });

  it("restricts the issuance RPC to the server service role", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });

  it("adds idempotency and normalized vehicle uniqueness", () => {
    expect(sql).toContain("purchase_request_id");
    expect(sql).toContain("vehicles_plate_number_normalized_unique");
    expect(sql).toContain("vehicles_vin_normalized_unique");
  });
});
