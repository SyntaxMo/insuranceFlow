import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildClaimEmail,
  buildClaimSubmissionEmail,
  CLAIM_EMAIL_SENDER,
  sendClaimSubmissionEmail,
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

  it("sends an explicit rejection email to the supplied customer recipient", async () => {
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
    expect(body.subject).toBe("Your claim CLM-2 has been rejected");
    expect(body.html).toContain("Your claim has been rejected");
    expect(body.html).toContain("The submitted evidence does not support the claim.");
    expect(body.text).toContain("Reason: The submitted evidence does not support the claim.");
    expect(body.html).toContain("View claim");
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

  it("builds a complete claim-submission confirmation", () => {
    const result = buildClaimSubmissionEmail({
      recipient: "customer@example.com",
      customerName: "Mohammed Ali",
      claimId: "claim-4",
      claimNumber: "CLM-2026-2612",
      vehicle: { make: "toyota", model: "corolla", year: 2026 },
      accidentDate: "2026-09-01",
      submittedAt: "2026-09-19T10:00:00.000Z",
    });

    expect(result.subject).toBe("We received your claim CLM-2026-2612");
    expect(result.text).toContain("Hi Mohammed,");
    expect(result.text).toContain("Claim number: CLM-2026-2612");
    expect(result.text).toContain("Vehicle: Toyota Corolla (2026)");
    expect(result.text).toContain("Accident date: Sep 1, 2026");
    expect(result.text).toContain("Submitted date: Sep 19, 2026");
    expect(result.text).toContain("Status: New");
    expect(result.text).toContain("/dashboard/claims/claim-4");
    expect(result.html).toContain("View claim");
    expect(result.text).toContain("portfolio demonstration");
  });

  it("sends the claim-submission confirmation with the shared sender", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email-id" }), { status: 200 }),
    );

    await expect(sendClaimSubmissionEmail({
      recipient: "profile@example.com",
      customerName: "Customer",
      claimId: "claim-5",
      claimNumber: "CLM-2026-3000",
      vehicle: { make: "Kia", model: "Sorento", year: 2025 },
      accidentDate: "2026-09-05",
      submittedAt: "2026-09-19T10:00:00.000Z",
    })).resolves.toBe(true);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.from).toBe(CLAIM_EMAIL_SENDER);
    expect(body.to).toEqual(["profile@example.com"]);
    expect(body.subject).toBe("We received your claim CLM-2026-3000");
    expect(body.html).toContain("Kia Sorento (2025)");
    expect(body.html).toContain("View claim");
    expect(body.text).toContain("portfolio demonstration");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Idempotency-Key"))
      .toBe("claim-submitted/claim-5");
  });
});
