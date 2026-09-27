import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { safeErrorDetails } from "@/lib/ai/debug";

describe("safeErrorDetails", () => {
  it("keeps diagnostic classification while excluding raw provider and customer content", () => {
    const error = Object.assign(
      new Error("Request failed for customer@example.com with claim narrative"),
      {
        statusCode: 502,
        code: "provider_unavailable",
        body: JSON.stringify({ prompt: "private accident description" }),
        details: "private storage/path/report.pdf",
        hint: "Bearer secret-token",
      },
    );

    const details = safeErrorDetails(error);

    expect(details).toEqual({
      name: "Error",
      statusCode: 502,
      code: "provider_unavailable",
    });
    expect(JSON.stringify(details)).not.toContain("customer@example.com");
    expect(JSON.stringify(details)).not.toContain("private accident description");
    expect(JSON.stringify(details)).not.toContain("report.pdf");
    expect(JSON.stringify(details)).not.toContain("secret-token");
  });
});
