import { describe, expect, it } from "vitest";
import { signInDestination } from "./destinations";
describe("safe Settings email-link return", () => {
  it("allows only the named customer Settings destination", () => {
    expect(signInDestination("CUSTOMER", "settings")).toBe("/dashboard/settings?section=privacy");
    for (const next of ["https://attacker.example", "//attacker.example", "/admin", "/dashboard/settings", null]) expect(signInDestination("CUSTOMER", next)).toBe("/dashboard");
  });
  it.each(["ADMIN", "CLAIMS_OFFICER"] as const)("preserves staff routing for %s", role => { expect(signInDestination(role, "settings")).toBe("/admin"); });
});
