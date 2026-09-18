import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { sendClaimStatusEmailMock } = vi.hoisted(() => ({ sendClaimStatusEmailMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/claims/emails", () => ({ sendClaimStatusEmail: sendClaimStatusEmailMock }));

import { runOfficerClaimAction, submitCustomerClaimResponse } from "@/lib/claims/workflow-server";

function terminal<T>(result: T) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit", "insert", "delete"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

const officer = { id: "officer-1", full_name: "Officer", email: "officer@example.com", phone: null, role: "CLAIMS_OFFICER" as const, auth_user_id: "auth-officer" };
const customer = { id: "customer-1", full_name: "Customer", email: "customer@example.com", phone: "+973 1", role: "CUSTOMER" as const, auth_user_id: "auth-customer" };

describe("server claim workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendClaimStatusEmailMock.mockResolvedValue(true);
  });

  it("starts review through the atomic RPC with the authenticated officer", async () => {
    const claims = terminal({ data: { status: "SUBMITTED" }, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: [{ new_status: "UNDER_REVIEW" }], error: null });
    const client = { from: vi.fn(() => claims), rpc } as unknown as SupabaseClient;
    const result = await runOfficerClaimAction({ claimId: "claim-1", action: "start_review", note: null, staff: officer, supabase: client });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_claim_status", expect.objectContaining({
      p_claim_id: "claim-1",
      p_to_status: "UNDER_REVIEW",
      p_action: "REVIEW_STARTED",
      p_actor_user_id: "officer-1",
    }));
    expect(sendClaimStatusEmailMock).not.toHaveBeenCalled();
  });

  it("closes a decided claim without sending a customer email", async () => {
    const claims = terminal({ data: { status: "APPROVED" }, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: [{ new_status: "CLOSED" }], error: null });
    const client = { from: vi.fn(() => claims), rpc } as unknown as SupabaseClient;

    const result = await runOfficerClaimAction({
      claimId: "claim-1",
      action: "close",
      note: null,
      staff: officer,
      supabase: client,
    });

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_claim_status", expect.objectContaining({
      p_to_status: "CLOSED",
      p_action: "CLAIM_CLOSED",
    }));
    expect(sendClaimStatusEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a non-staff actor before reading or mutating the claim", async () => {
    const client = { from: vi.fn(), rpc: vi.fn() } as unknown as SupabaseClient;
    const result = await runOfficerClaimAction({
      claimId: "claim-1",
      action: "start_review",
      note: null,
      staff: customer,
      supabase: client,
    });
    expect(result).toEqual({
      ok: false,
      error: "You are not authorized to update this claim.",
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects a stale transition before creating duplicate history", async () => {
    const claims = terminal({ data: { status: "APPROVED" }, error: null });
    const rpc = vi.fn();
    const client = { from: vi.fn(() => claims), rpc } as unknown as SupabaseClient;
    const result = await runOfficerClaimAction({ claimId: "claim-1", action: "reject", note: "Reason", staff: officer, supabase: client });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/current status/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a stale Start review before creating duplicate history", async () => {
    const claims = terminal({ data: { status: "UNDER_REVIEW" }, error: null });
    const rpc = vi.fn();
    const client = { from: vi.fn(() => claims), rpc } as unknown as SupabaseClient;
    const result = await runOfficerClaimAction({ claimId: "claim-1", action: "start_review", note: null, staff: officer, supabase: client });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/current status/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires an information request message", async () => {
    const client = { from: vi.fn(), rpc: vi.fn() } as unknown as SupabaseClient;
    const result = await runOfficerClaimAction({ claimId: "claim-1", action: "request_more_info", note: "", staff: officer, supabase: client });
    expect(result.ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("keeps a successful approval when email delivery fails", async () => {
    const statusQuery = terminal({ data: { status: "UNDER_REVIEW" }, error: null });
    const notificationQuery = terminal({ data: { claim_number: "CLM-1", contact_email: "customer@example.com", policies: { users: { full_name: "Customer", email: "customer@example.com" } } }, error: null });
    const submissionQuery = terminal({ data: { users: { full_name: "Customer", email: "customer@example.com" } }, error: null });
    const from = vi.fn().mockReturnValueOnce(statusQuery).mockReturnValueOnce(notificationQuery).mockReturnValueOnce(submissionQuery);
    const rpc = vi.fn().mockResolvedValue({ data: [{ new_status: "APPROVED" }], error: null });
    sendClaimStatusEmailMock.mockResolvedValue(false);
    const client = { from, rpc } as unknown as SupabaseClient;
    const result = await runOfficerClaimAction({ claimId: "claim-1", action: "approve", note: "Reviewed", staff: officer, supabase: client });
    expect(result).toEqual({ ok: true, emailDelivered: false });
    expect(rpc).toHaveBeenCalledOnce();
    expect(sendClaimStatusEmailMock).toHaveBeenCalledWith(expect.objectContaining({ recipient: "customer@example.com", kind: "APPROVED" }));
  });

  it("persists an information request atomically and emails the submitting customer", async () => {
    const statusQuery = terminal({ data: { status: "UNDER_REVIEW" }, error: null });
    const notificationQuery = terminal({ data: { claim_number: "CLM-2026-0001", contact_email: "fallback@example.com", policies: { users: { full_name: "Policy owner", email: "owner@example.com" } } }, error: null });
    const submissionQuery = terminal({ data: { users: { full_name: "Aisha Customer", email: "aisha@example.com" } }, error: null });
    const from = vi.fn().mockReturnValueOnce(statusQuery).mockReturnValueOnce(notificationQuery).mockReturnValueOnce(submissionQuery);
    const rpc = vi.fn().mockResolvedValue({ data: [{ new_status: "MORE_INFO_REQUIRED" }], error: null });
    const client = { from, rpc } as unknown as SupabaseClient;
    const result = await runOfficerClaimAction({
      claimId: "claim-1",
      action: "request_more_info",
      note: "Please upload the police report.",
      staff: officer,
      supabase: client,
    });
    expect(result).toEqual({ ok: true, emailDelivered: true });
    expect(rpc).toHaveBeenCalledWith("transition_claim_status", expect.objectContaining({
      p_to_status: "MORE_INFO_REQUIRED",
      p_action: "MORE_INFO_REQUESTED",
      p_note: "Please upload the police report.",
      p_actor_user_id: "officer-1",
    }));
    expect(sendClaimStatusEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: "MORE_INFO_REQUIRED",
      recipient: "aisha@example.com",
      customerName: "Aisha Customer",
      claimNumber: "CLM-2026-0001",
      note: "Please upload the police report.",
    }));
  });

  it("blocks a customer response for a claim the customer does not own", async () => {
    const claimQuery = terminal({ data: { claim_number: "CLM-1", status: "MORE_INFO_REQUIRED", policy_id: "policy-1" }, error: null });
    const policyQuery = terminal({ data: { user_id: "another-customer" }, error: null });
    const linkQuery = terminal({ data: null, error: null });
    const from = vi.fn().mockReturnValueOnce(claimQuery).mockReturnValueOnce(policyQuery).mockReturnValueOnce(linkQuery);
    const client = { from, rpc: vi.fn() } as unknown as SupabaseClient;
    const form = new FormData(); form.set("responseMessage", "Response");
    const result = await submitCustomerClaimResponse({ claimId: "claim-1", formData: form, customer, supabase: client });
    expect(result).toEqual({ ok: false, error: "This claim could not be found." });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns an owned customer response to review without changing the decision", async () => {
    const claimQuery = terminal({ data: { claim_number: "CLM-1", status: "MORE_INFO_REQUIRED", policy_id: "policy-1" }, error: null });
    const policyQuery = terminal({ data: { user_id: "customer-1" }, error: null });
    const from = vi.fn().mockReturnValueOnce(claimQuery).mockReturnValueOnce(policyQuery);
    const rpc = vi.fn().mockResolvedValue({ data: [{ new_status: "UNDER_REVIEW" }], error: null });
    const client = { from, rpc, storage: { from: vi.fn() } } as unknown as SupabaseClient;
    const form = new FormData(); form.set("responseMessage", "The police report number is 123.");
    const result = await submitCustomerClaimResponse({ claimId: "claim-1", formData: form, customer, supabase: client });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_claim_status", expect.objectContaining({
      p_to_status: "UNDER_REVIEW",
      p_action: "CUSTOMER_INFO_SUBMITTED",
      p_actor_user_id: "customer-1",
    }));
    expect(sendClaimStatusEmailMock).not.toHaveBeenCalled();
  });

  it("stores permitted additional evidence before returning the claim to review", async () => {
    const claimQuery = terminal({ data: { claim_number: "CLM-1", status: "MORE_INFO_REQUIRED", policy_id: "policy-1" }, error: null });
    const policyQuery = terminal({ data: { user_id: "customer-1" }, error: null });
    const documentQuery = terminal({ data: { id: "document-1" }, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(claimQuery)
      .mockReturnValueOnce(policyQuery)
      .mockReturnValueOnce(documentQuery);
    const upload = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn(() => ({ upload, remove: vi.fn() }));
    const rpc = vi.fn().mockResolvedValue({ data: [{ new_status: "UNDER_REVIEW" }], error: null });
    const client = { from, rpc, storage: { from: storageFrom } } as unknown as SupabaseClient;
    const form = new FormData();
    form.set("responseMessage", "Attached as requested.");
    form.append("additionalFiles", new File(["image"], "rear-damage.jpg", { type: "image/jpeg" }));
    const result = await submitCustomerClaimResponse({ claimId: "claim-1", formData: form, customer, supabase: client });
    expect(result).toEqual({ ok: true });
    expect(storageFrom).toHaveBeenCalledWith("claim-documents");
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^CLM-1\/additional-information-\d+-0-rear-damage\.jpg$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg", upsert: false }),
    );
    expect(documentQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      claim_id: "claim-1",
      document_type: "ADDITIONAL_INFORMATION",
      file_name: "rear-damage.jpg",
    }));
    expect(rpc).toHaveBeenCalledWith("transition_claim_status", expect.objectContaining({
      p_action: "CUSTOMER_INFO_SUBMITTED",
      p_to_status: "UNDER_REVIEW",
    }));
  });

  it("keeps a closed claim immutable when a customer tries to respond", async () => {
    const claimQuery = terminal({ data: { claim_number: "CLM-1", status: "CLOSED", policy_id: "policy-1" }, error: null });
    const policyQuery = terminal({ data: { user_id: "customer-1" }, error: null });
    const from = vi.fn().mockReturnValueOnce(claimQuery).mockReturnValueOnce(policyQuery);
    const client = { from, rpc: vi.fn() } as unknown as SupabaseClient;
    const form = new FormData(); form.set("responseMessage", "Late response");
    const result = await submitCustomerClaimResponse({ claimId: "claim-1", formData: form, customer, supabase: client });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not currently waiting/i);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
