import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStaffForApiMock, getAuthorizedClaimDocumentMock, createServiceRoleClientMock } = vi.hoisted(() => ({
  getStaffForApiMock: vi.fn(),
  getAuthorizedClaimDocumentMock: vi.fn(),
  createServiceRoleClientMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getStaffForApi: getStaffForApiMock }));
vi.mock("@/lib/claims/admin", () => ({ getAuthorizedClaimDocument: getAuthorizedClaimDocumentMock }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: createServiceRoleClientMock, getStorageBucket: () => "claim-documents" }));

import { GET } from "@/app/api/admin/claims/[id]/documents/[documentId]/route";

describe("officer claim document route", () => {
  const createSignedUrl = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getStaffForApiMock.mockResolvedValue({ id: "officer", role: "CLAIMS_OFFICER" });
    getAuthorizedClaimDocumentMock.mockResolvedValue({ filePath: "CLM/report.pdf", fileName: "report.pdf" });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/report" }, error: null });
    createServiceRoleClientMock.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } });
  });

  it("rejects unauthenticated access before looking up storage metadata", async () => {
    getStaffForApiMock.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/file"), { params: Promise.resolve({ id: "claim-1", documentId: "doc-1" }) });
    expect(response.status).toBe(403);
    expect(getAuthorizedClaimDocumentMock).not.toHaveBeenCalled();
  });

  it("rejects a customer session before looking up or signing claim evidence", async () => {
    getStaffForApiMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/file"), { params: Promise.resolve({ id: "another-customer-claim", documentId: "doc-1" }) });

    expect(response.status).toBe(403);
    expect(getAuthorizedClaimDocumentMock).not.toHaveBeenCalled();
    expect(createServiceRoleClientMock).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("does not create a signed URL when the stored document is not part of the authorized claim", async () => {
    getAuthorizedClaimDocumentMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/file"), { params: Promise.resolve({ id: "claim-1", documentId: "another-claim-document" }) });

    expect(response.status).toBe(404);
    expect(createServiceRoleClientMock).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("resolves the path by claim and document IDs instead of accepting a browser path", async () => {
    const response = await GET(new Request("http://localhost/file?path=attacker/secret.pdf"), { params: Promise.resolve({ id: "claim-1", documentId: "doc-1" }) });
    expect(response.status).toBe(307);
    expect(getAuthorizedClaimDocumentMock).toHaveBeenCalledWith({ claimId: "claim-1", documentId: "doc-1" });
    expect(createSignedUrl).toHaveBeenCalledWith("CLM/report.pdf", 180, undefined);
  });
});
