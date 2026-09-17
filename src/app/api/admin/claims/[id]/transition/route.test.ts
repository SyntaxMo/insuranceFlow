import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStaffForApiMock, runOfficerClaimActionMock, revalidatePathMock } = vi.hoisted(() => ({
  getStaffForApiMock: vi.fn(),
  runOfficerClaimActionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getStaffForApi: getStaffForApiMock }));
vi.mock("@/lib/claims/workflow-server", () => ({ runOfficerClaimAction: runOfficerClaimActionMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { POST } from "@/app/api/admin/claims/[id]/transition/route";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/claims/claim-1/transition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("officer claim transition route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStaffForApiMock.mockResolvedValue({ id: "officer-1", role: "CLAIMS_OFFICER" });
    runOfficerClaimActionMock.mockResolvedValue({ ok: true });
  });

  it("rejects unauthenticated and customer callers", async () => {
    getStaffForApiMock.mockResolvedValue(null);
    const response = await POST(request({ action: "approve" }), { params: Promise.resolve({ id: "claim-1" }) });
    expect(response.status).toBe(403);
    expect(runOfficerClaimActionMock).not.toHaveBeenCalled();
  });

  it("derives the officer identity from the session and ignores browser actor fields", async () => {
    const response = await POST(request({ action: "approve", note: "Reviewed", officer_user_id: "attacker" }), { params: Promise.resolve({ id: "claim-1" }) });
    expect(response.status).toBe(200);
    expect(runOfficerClaimActionMock).toHaveBeenCalledWith({
      claimId: "claim-1",
      action: "approve",
      note: "Reviewed",
      staff: expect.objectContaining({ id: "officer-1" }),
    });
  });

  it("rejects unsupported browser actions", async () => {
    const response = await POST(request({ action: "ai_approve" }), { params: Promise.resolve({ id: "claim-1" }) });
    expect(response.status).toBe(400);
    expect(runOfficerClaimActionMock).not.toHaveBeenCalled();
  });

  it("rejects the retired Return to New application action", async () => {
    const response = await POST(request({ action: "return_to_new" }), {
      params: Promise.resolve({ id: "claim-1" }),
    });
    expect(response.status).toBe(400);
    expect(runOfficerClaimActionMock).not.toHaveBeenCalled();
  });
});
