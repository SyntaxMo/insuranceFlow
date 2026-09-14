import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceRoleClientMock, generatePolicyPdfMock } = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
  generatePolicyPdfMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: createServiceRoleClientMock }));
vi.mock("@/lib/policies/policy-pdf", () => ({ generatePolicyPdf: generatePolicyPdfMock }));

import {
  deliverIssuedPolicyDocument,
  POLICY_DOCUMENT_BUCKET,
  POLICY_DOCUMENT_MIME,
} from "@/lib/policies/policy-document-delivery";

const customer = {
  id: "2a000000-0000-4000-8000-000000000001",
  full_name: "Mohammed Ali",
  email: "mohammed@example.com",
  phone: "+973 1234 5678",
  role: "CUSTOMER" as const,
  auth_user_id: "auth-user",
};
const policyId = "8f000000-0000-4000-8000-000000000002";
const policy = {
  id: policyId,
  policy_number: "MOT-2026-D95F565D",
  status: "ACTIVE",
  coverage_type: "COMPREHENSIVE",
  start_date: "2026-09-13",
  end_date: "2027-09-12",
  excess_amount: 150,
  coverage_limit: 9500,
  annual_premium: 171,
  purchase_request_id: "22087e7d-4c89-4b10-9620-ec8c525b0718",
  vehicles: { make: "Toyota", model: "Corolla", year: 2026, plate_number: "927410", vin: null },
};
const metadata = {
  policy_id: policyId,
  document_type: "POLICY_DOCUMENT",
  file_path: `${customer.id}/${policyId}/policy-document.pdf`,
  file_name: "InsureFlow-MOT-2026-D95F565D.pdf",
  mime_type: "application/pdf",
  file_size_bytes: 9,
};

function maybeSingleQuery(result: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), not: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

function deliveryClient(options: {
  existing?: typeof metadata | null;
  metadataInsertError?: { code: string } | null;
  concurrent?: typeof metadata | null;
  uploadError?: { message: string } | null;
} = {}) {
  const policyQuery = maybeSingleQuery({ data: policy, error: null });
  const initialMetadataQuery = maybeSingleQuery({ data: options.existing ?? null, error: null });
  const concurrentMetadataQuery = maybeSingleQuery({ data: options.concurrent ?? null, error: null });
  const insert = vi.fn().mockResolvedValue({ error: options.metadataInsertError ?? null });
  let policyDocumentCall = 0;
  const from = vi.fn((table: string) => {
    if (table === "policies") return policyQuery;
    if (table === "policy_documents") {
      policyDocumentCall += 1;
      if (policyDocumentCall === 1) return initialMetadataQuery;
      if (policyDocumentCall === 2) return { insert };
      return concurrentMetadataQuery;
    }
    throw new Error(`Unexpected table ${table}`);
  });
  const upload = vi.fn().mockResolvedValue({ data: options.uploadError ? null : { path: metadata.file_path }, error: options.uploadError ?? null });
  const storageFrom = vi.fn().mockReturnValue({ upload });
  createServiceRoleClientMock.mockReturnValue({ from, storage: { from: storageFrom } });
  return { from, insert, upload, storageFrom, policyQuery };
}

describe("issued policy document delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-resend-key";
    generatePolicyPdfMock.mockResolvedValue(new TextEncoder().encode("%PDF-test"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ id: "email-id" }) }));
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uploads one canonical PDF, records metadata, and emails the server-derived customer", async () => {
    const database = deliveryClient();
    const result = await deliverIssuedPolicyDocument({ customer, policyId });

    expect(result).toEqual({ documentAvailable: true, emailSent: true });
    expect(database.policyQuery.eq).toHaveBeenCalledWith("user_id", customer.id);
    expect(database.policyQuery.not).toHaveBeenCalledWith("purchase_request_id", "is", null);
    expect(database.storageFrom).toHaveBeenCalledWith(POLICY_DOCUMENT_BUCKET);
    expect(database.upload).toHaveBeenCalledWith(
      metadata.file_path,
      expect.any(Buffer),
      { contentType: POLICY_DOCUMENT_MIME, cacheControl: "3600", upsert: true },
    );
    expect(database.insert).toHaveBeenCalledWith(metadata);
    expect(generatePolicyPdfMock).toHaveBeenCalledWith(expect.objectContaining({
      customer: { fullName: "Mohammed Ali", email: "mohammed@example.com", phone: "+973 1234 5678" },
      vehicle: { make: "Toyota", model: "Corolla", year: 2026, plateNumber: "927410", vin: null },
      policy: expect.objectContaining({ coverageType: "COMPREHENSIVE", annualPremium: 171 }),
    }));

    const request = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body));
    expect(body.from).toBe("InsureFlow <noreply@insureflow.infaqbh.me>");
    expect(body.to).toEqual(["mohammed@example.com"]);
    expect(body.subject).toBe("Your InsureFlow motor policy MOT-2026-D95F565D");
    expect(body.text).toContain("portfolio demonstration");
    expect(body.html).toContain("portfolio demonstration");
    expect(body.attachments).toEqual([{ filename: metadata.file_name, content: Buffer.from("%PDF-test").toString("base64") }]);
  });

  it("reuses existing metadata without generating, uploading, or resending", async () => {
    const database = deliveryClient({ existing: metadata });
    const firstRetry = await deliverIssuedPolicyDocument({ customer, policyId });

    expect(firstRetry).toEqual({ documentAvailable: true, emailSent: false });
    expect(generatePolicyPdfMock).not.toHaveBeenCalled();
    expect(database.upload).not.toHaveBeenCalled();
    expect(database.insert).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles a concurrent metadata uniqueness conflict without a duplicate email", async () => {
    const database = deliveryClient({ metadataInsertError: { code: "23505" }, concurrent: metadata });
    const result = await deliverIssuedPolicyDocument({ customer, policyId });

    expect(result).toEqual({ documentAvailable: true, emailSent: false });
    expect(database.upload).toHaveBeenCalledOnce();
    expect(database.insert).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the stored document available when Resend fails", async () => {
    deliveryClient();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    const result = await deliverIssuedPolicyDocument({ customer, policyId });

    expect(result.documentAvailable).toBe(true);
    expect(result.emailSent).toBe(false);
    expect(result.warning).toMatch(/issued successfully/i);
  });

  it("returns a non-blocking delivery warning when private storage upload fails", async () => {
    const database = deliveryClient({ uploadError: { message: "storage unavailable" } });
    const result = await deliverIssuedPolicyDocument({ customer, policyId });

    expect(result.documentAvailable).toBe(false);
    expect(result.warning).toMatch(/issued successfully/i);
    expect(database.insert).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
