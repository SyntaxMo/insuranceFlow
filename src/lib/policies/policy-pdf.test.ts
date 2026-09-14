import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PDFDocument } from "pdf-lib";
import {
  generatePolicyPdf,
  getPolicyPdfText,
  POLICY_DOCUMENT_MAX_BYTES,
  type PolicyPdfData,
} from "@/lib/policies/policy-pdf";

const data: PolicyPdfData = {
  policy: {
    policyNumber: "MOT-2026-D95F565D",
    status: "ACTIVE",
    coverageType: "COMPREHENSIVE",
    startDate: "2026-09-13",
    endDate: "2027-09-12",
    excessAmount: 150,
    coverageLimit: 9500,
    annualPremium: 171,
  },
  customer: {
    fullName: "Mohammed Ali",
    email: "mohammed@example.com",
    phone: "+973 1234 5678",
  },
  vehicle: {
    make: "Toyota",
    model: "Corolla",
    year: 2026,
    plateNumber: "927410",
    vin: null,
  },
};

describe("policy PDF generation", () => {
  it("generates a valid compact PDF document", async () => {
    const bytes = await generatePolicyPdf(data);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeLessThan(POLICY_DOCUMENT_MAX_BYTES);
    expect(bytes.byteLength).toBeLessThan(1_000_000);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
  });

  it("uses customer-friendly labels, persisted BHD values, and a visible demo disclaimer", () => {
    const text = getPolicyPdfText(data);
    expect(text.coverage).toBe("Comprehensive");
    expect(text.excess).toBe("BHD 150");
    expect(text.coverageLimit).toBe("BHD 9,500");
    expect(text.annualPremium).toBe("BHD 171");
    expect(text.disclaimer).toContain("software portfolio demonstration");
    expect(text.disclaimer).toContain("does not create real insurance coverage");
  });
});
