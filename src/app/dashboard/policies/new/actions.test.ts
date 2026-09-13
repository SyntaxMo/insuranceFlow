import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCustomerMock, createServiceRoleClientMock, revalidatePathMock } = vi.hoisted(() => ({
  requireCustomerMock: vi.fn(),
  createServiceRoleClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: requireCustomerMock }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: createServiceRoleClientMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { getDemoPolicyQuote, issueDemoPolicy } from "@/app/dashboard/policies/new/actions";

const requestId = "22087e7d-4c89-4b10-9620-ec8c525b0718";

function validForm() {
  const form = new FormData();
  form.set("make", "Toyota");
  form.set("model", "Corolla");
  form.set("year", String(new Date().getUTCFullYear()));
  form.set("plateNumber", "927410");
  form.set("vin", "");
  form.set("estimatedVehicleValue", "9500");
  form.set("coverage", "COMPREHENSIVE");
  form.set("requestId", requestId);
  return form;
}

describe("demo policy actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomerMock.mockResolvedValue({ id: "portal-user", full_name: "Customer", email: "customer@example.com" });
  });

  it("creates a quote only after authenticating the customer", async () => {
    const result = await getDemoPolicyQuote({ make: "Toyota", model: "Corolla", year: new Date().getUTCFullYear(), plateNumber: "927410", vin: "", estimatedVehicleValue: 9500, coverage: "COMPREHENSIVE" });
    expect(requireCustomerMock).toHaveBeenCalledOnce();
    expect(result.ok && result.quote.annualPremium).toBe(171);
  });

  it("recalculates authoritative values and derives direct ownership server-side", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ outcome: "issued", issued_policy_id: "policy-id", issued_vehicle_id: "vehicle-id", issued_policy_number: "MOT-2026-ABC12345", issued_start_date: "2026-09-13", issued_end_date: "2027-09-12" }], error: null });
    createServiceRoleClientMock.mockReturnValue({ rpc });
    const form = validForm();
    form.set("annualPremium", "0.001");
    form.set("userId", "attacker-user");
    form.set("status", "CANCELLED");

    const result = await issueDemoPolicy({ status: "idle" }, form);

    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("issue_demo_motor_policy", expect.objectContaining({ p_portal_user_id: "portal-user", p_plate_number: "927410", p_vin: "", p_annual_premium: 171, p_excess_amount: 150, p_coverage_limit: 9500 }));
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("p_status");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });

  it("maps duplicate vehicle results without exposing database errors", async () => {
    createServiceRoleClientMock.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: [{ outcome: "duplicate_plate" }], error: null }) });
    const result = await issueDemoPolicy({ status: "idle" }, validForm());
    expect(result).toMatchObject({ status: "error", message: "A vehicle with this plate number is already registered." });
  });

  it("rejects an old-format plate before the issuance RPC", async () => {
    const rpc = vi.fn();
    createServiceRoleClientMock.mockReturnValue({ rpc });
    const form = validForm();
    form.set("plateNumber", "BH-927410");

    const result = await issueDemoPolicy({ status: "idle" }, form);

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { plateNumber: "Enter a valid Bahrain plate number using 5 or 6 digits." },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("treats an idempotent retry as the same successful issuance", async () => {
    createServiceRoleClientMock.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: [{ outcome: "already_issued", issued_policy_id: "same-policy", issued_vehicle_id: "same-vehicle", issued_policy_number: "MOT-2026-SAME0001", issued_start_date: "2026-09-13", issued_end_date: "2027-09-12" }], error: null }) });
    const result = await issueDemoPolicy({ status: "idle" }, validForm());
    expect(result).toMatchObject({ status: "success", policy: { id: "same-policy", policyNumber: "MOT-2026-SAME0001" } });
  });

  it("does not touch the database if authentication fails", async () => {
    requireCustomerMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    const rpc = vi.fn();
    createServiceRoleClientMock.mockReturnValue({ rpc });
    await expect(issueDemoPolicy({ status: "idle" }, validForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(rpc).not.toHaveBeenCalled();
  });
});
