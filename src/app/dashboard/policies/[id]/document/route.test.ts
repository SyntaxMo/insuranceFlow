import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCustomerForApiMock,
  getCustomerPolicyDetailsMock,
  getPolicyDocumentMetadataMock,
  createServiceRoleClientMock,
} = vi.hoisted(() => ({
  getCustomerForApiMock: vi.fn(),
  getCustomerPolicyDetailsMock: vi.fn(),
  getPolicyDocumentMetadataMock: vi.fn(),
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCustomerForApi: getCustomerForApiMock }));
vi.mock("@/lib/claims/customer", () => ({ getCustomerPolicyDetails: getCustomerPolicyDetailsMock }));
vi.mock("@/lib/policies/policy-document-delivery", () => ({
  getPolicyDocumentMetadata: getPolicyDocumentMetadataMock,
  POLICY_DOCUMENT_BUCKET: "policy-documents",
  POLICY_DOCUMENT_SIGNED_URL_SECONDS: 120,
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: createServiceRoleClientMock }));

import { GET } from "@/app/dashboard/policies/[id]/document/route";

const policyId = "8f000000-0000-4000-8000-000000000002";
const metadata = {
  file_path: "portal-user/8f000000-0000-4000-8000-000000000002/policy-document.pdf",
  file_name: "InsureFlow-MOT-2026-D95F565D.pdf",
};

function context(id = policyId) {
  return { params: Promise.resolve({ id }) };
}

describe("policy document download route", () => {
  const createSignedUrl = vi.fn();
  const storageFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getCustomerForApiMock.mockResolvedValue({ id: "portal-user", role: "CUSTOMER" });
    getCustomerPolicyDetailsMock.mockResolvedValue({ policy: { id: policyId }, error: null });
    getPolicyDocumentMetadataMock.mockResolvedValue(metadata);
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example.test/signed-policy" }, error: null });
    storageFrom.mockReturnValue({ createSignedUrl });
    createServiceRoleClientMock.mockReturnValue({ storage: { from: storageFrom } });
  });

  it("authorizes the customer and redirects to a short-lived private signed URL", async () => {
    const response = await GET(new Request(`http://localhost/dashboard/policies/${policyId}/document`), context());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://storage.example.test/signed-policy");
    expect(getCustomerPolicyDetailsMock).toHaveBeenCalledWith("portal-user", policyId);
    expect(storageFrom).toHaveBeenCalledWith("policy-documents");
    expect(createSignedUrl).toHaveBeenCalledWith(metadata.file_path, 120, { download: metadata.file_name });
  });

  it("rejects an unauthenticated request before document lookup", async () => {
    getCustomerForApiMock.mockResolvedValue(null);
    const response = await GET(new Request(`http://localhost/dashboard/policies/${policyId}/document`), context());
    expect(response.status).toBe(401);
    expect(getCustomerPolicyDetailsMock).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("does not disclose or sign another customer's policy document", async () => {
    getCustomerPolicyDetailsMock.mockResolvedValue({ policy: null, error: null });
    const response = await GET(new Request(`http://localhost/dashboard/policies/${policyId}/document`), context());
    expect(response.status).toBe(404);
    expect(getPolicyDocumentMetadataMock).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns a safe unavailable response when metadata is missing", async () => {
    getPolicyDocumentMetadataMock.mockResolvedValue(null);
    const response = await GET(new Request(`http://localhost/dashboard/policies/${policyId}/document`), context());
    expect(response.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("ignores arbitrary client storage paths and signs only the stored metadata path", async () => {
    const response = await GET(new Request(`http://localhost/dashboard/policies/${policyId}/document?path=another-user/private.pdf`), context());
    expect(response.status).toBe(302);
    expect(createSignedUrl).toHaveBeenCalledWith(metadata.file_path, 120, { download: metadata.file_name });
    expect(JSON.stringify(createSignedUrl.mock.calls)).not.toContain("another-user/private.pdf");
  });
});
