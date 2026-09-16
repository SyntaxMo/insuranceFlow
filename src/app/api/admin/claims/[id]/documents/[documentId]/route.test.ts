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
  beforeEach(() => {
    vi.clearAllMocks();
    getStaffForApiMock.mockResolvedValue({ id: "officer", role: "CLAIMS_OFFICER" });
    getAuthorizedClaimDocumentMock.mockResolvedValue({ filePath: "CLM/report.pdf", fileName: "report.pdf" });
    createServiceRoleClientMock.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/report" }, error: null }) })) } });
  });

  it("rejects unauthenticated access before looking up storage metadata", async () => {
    getStaffForApiMock.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/file"), { params: Promise.resolve({ id: "claim-1", documentId: "doc-1" }) });
    expect(response.status).toBe(403);
    expect(getAuthorizedClaimDocumentMock).not.toHaveBeenCalled();
  });

  it("resolves the path by claim and document IDs instead of accepting a browser path", async () => {
    const response = await GET(new Request("http://localhost/file?path=attacker/secret.pdf"), { params: Promise.resolve({ id: "claim-1", documentId: "doc-1" }) });
    expect(response.status).toBe(307);
    expect(getAuthorizedClaimDocumentMock).toHaveBeenCalledWith({ claimId: "claim-1", documentId: "doc-1" });
  });
});
