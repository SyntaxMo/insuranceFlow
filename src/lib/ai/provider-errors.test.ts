import { describe, expect, it } from "vitest";
import { classifyProviderFailure, providerFailureLogDetails } from "@/lib/ai/provider-errors";

describe("claim analysis provider failure classification", () => {
  it("recognizes the observed Nvidia ResourceExhausted error envelope", () => {
    const error = Object.assign(new Error("Response validation failed"), {
      name: "ResponseValidationError", statusCode: 200,
      body: JSON.stringify({ id: "gen-test-id", error: { message: "Upstream error from Nvidia: ResourceExhausted: request limit reached", code: 502, metadata: { error_type: "provider_unavailable" } } }),
    });
    expect(classifyProviderFailure(error)).toEqual({ category: "PROVIDER_CAPACITY", retryable: true, statusCode: 200, providerRequestId: "gen-test-id", providerErrorCode: "502", providerErrorType: "provider_unavailable" });
  });

  it("recognizes the observed DOM timeout without treating it as retryable", () => {
    const error = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    expect(classifyProviderFailure(error)).toMatchObject({ category: "PROVIDER_TIMEOUT", retryable: false });
  });

  it("returns only safe structured diagnostics", () => {
    const info = classifyProviderFailure(Object.assign(new Error("Response validation failed"), {
      statusCode: 200,
      body: JSON.stringify({ id: "gen-test-id", error: { message: "Sensitive upstream detail that must not be logged", code: 502, metadata: { error_type: "provider_unavailable" } } }),
    }));
    expect(JSON.stringify(providerFailureLogDetails(info))).not.toContain("Sensitive upstream detail");
  });
});
