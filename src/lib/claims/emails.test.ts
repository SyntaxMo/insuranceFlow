import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildClaimEmail,
  CLAIM_EMAIL_SENDER,
  sendClaimStatusEmail,
} from "@/lib/claims/emails";

describe("claim status email", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-resend-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it("builds customer-safe demo request content", () => {
    const result = buildClaimEmail({
      kind: "MORE_INFO_REQUIRED",
      recipient: "customer@example.com",
      customerName: "Mohammed Ali",
      claimId: "claim-1",
      claimNumber: "CLM-2026-0001",
      note: "Please upload the police report.",
    });
    expect(result.subject).toBe("More information needed for claim CLM-2026-0001");
    expect(result.text).toContain("Hi Mohammed,");
    expect(result.text).toContain("Please upload the police report.");
    expect(result.html).toContain("View claim");
    expect(result.text).toContain("portfolio demonstration");
  });

  it("derives the Resend payload server-side", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email-id" }), { status: 200 }),
    );
    await expect(sendClaimStatusEmail({
      kind: "REJECTED",
      recipient: "customer@example.com",
      customerName: "Customer",
      claimId: "claim-2",
      claimNumber: "CLM-2",
      note: "The submitted evidence does not support the claim.",
    })).resolves.toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.from).toBe(CLAIM_EMAIL_SENDER);
    expect(body.to).toEqual(["customer@example.com"]);
    expect(body.subject).toContain("CLM-2");
    expect(body.html).toContain("portfolio demonstration");
  });

  it("returns false without undoing workflow state when Resend fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 503 }));
    await expect(sendClaimStatusEmail({
      kind: "APPROVED",
      recipient: "customer@example.com",
      customerName: null,
      claimId: "claim-3",
      claimNumber: "CLM-3",
      note: null,
    })).resolves.toBe(false);
  });
});
