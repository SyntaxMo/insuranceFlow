import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildDataDeletionRequestEmail, sendDataDeletionRequestEmail } from "./emails";

const input = { recipient: "customer@example.com", customerName: "Customer <Name>", requestId: "request-reference" };
describe("data deletion confirmation email", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("contains only a receipt, pending state, demo clarification and safe Settings sign-in gate", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://insureflow.example");
    const email = buildDataDeletionRequestEmail(input);
    expect(email.subject).toBe("We received your data deletion request");
    expect(email.text).toContain("pending");
    expect(email.text).toContain("remain available");
    expect(email.text).toContain("does not represent a real statutory deletion process");
    expect(email.text).toContain("https://insureflow.example/login?next=settings");
    expect(email.text).toContain("7–14 days");
    expect(email.text).toContain("Once processing begins, it can no longer be cancelled.");
    expect(email.html).toContain("Cancel deletion request");
    expect(email.html).not.toMatch(/requestId=|userId=|token=|cancel=true/);
    expect(email.html).not.toContain("<Name>");
    expect(email.text + email.html).not.toMatch(/request-reference|claim number|policy number|signedUrl|user_id/);
  });

  it("sends a minimal Resend payload with request-level idempotency", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://insureflow.example"); vi.stubEnv("RESEND_API_KEY", "test-key");
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
    expect(await sendDataDeletionRequestEmail(input)).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    const options = fetch.mock.calls[0][1];
    expect(options.headers["Idempotency-Key"]).toBe("data-deletion-request:request-reference");
    expect(JSON.parse(options.body).to).toEqual(["customer@example.com"]);
    expect(Object.keys(JSON.parse(options.body)).sort()).toEqual(["from", "html", "subject", "text", "to"]);
  });

  it.each(["provider", "network", "configuration"])("returns false and never logs private content on %s failure", async (failure) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://insureflow.example"); vi.stubEnv("RESEND_API_KEY", failure === "configuration" ? "" : "test-key");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    if (failure === "network") fetch.mockRejectedValue(new Error("private provider content"));
    else fetch.mockResolvedValue({ ok: false, status: 503, text: () => "private provider content" });
    expect(await sendDataDeletionRequestEmail(input)).toBe(false);
    const logs = JSON.stringify(log.mock.calls);
    expect(logs).not.toMatch(/customer@example|Customer|private provider content|test-key|request-reference/);
  });
});
