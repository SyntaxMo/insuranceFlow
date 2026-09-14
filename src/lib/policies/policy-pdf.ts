import "server-only";

import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatCoverageType, formatCurrency, formatDate, statusLabel } from "@/lib/format";

export const POLICY_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;

export type PolicyPdfData = {
  policy: {
    policyNumber: string;
    status: string;
    coverageType: string;
    startDate: string;
    endDate: string;
    excessAmount: number;
    coverageLimit: number;
    annualPremium: number;
  };
  customer: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
  vehicle: {
    make: string;
    model: string;
    year: number;
    plateNumber: string;
    vin: string | null;
  };
};

export function getPolicyPdfText(data: PolicyPdfData) {
  return {
    coverage: formatCoverageType(data.policy.coverageType),
    status: statusLabel(data.policy.status),
    startDate: formatDate(data.policy.startDate),
    endDate: formatDate(data.policy.endDate),
    excess: formatCurrency(data.policy.excessAmount),
    coverageLimit: formatCurrency(data.policy.coverageLimit),
    annualPremium: formatCurrency(data.policy.annualPremium),
    disclaimer: "InsureFlow is a software portfolio demonstration. This document is a simulated policy record and does not create real insurance coverage, financial obligations, or a legally binding insurance contract. Pricing, payments, and coverage shown are demonstration examples only.",
  };
}

const NAVY = rgb(0.035, 0.16, 0.25);
const TEAL = rgb(0.035, 0.51, 0.49);
const MUTED = rgb(0.36, 0.43, 0.5);
const BORDER = rgb(0.86, 0.89, 0.91);
const PALE_TEAL = rgb(0.93, 0.98, 0.97);
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

function pdfSafe(value: string | number | null | undefined): string {
  if (value == null || value === "") return "Not available";
  return String(value)
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(page: PDFPage, text: string, x: number, y: number, options: {
  font: PDFFont;
  size: number;
  color: ReturnType<typeof rgb>;
  maxWidth: number;
  lineHeight: number;
}): number {
  const lines = wrapText(text, options.font, options.size, options.maxWidth);
  lines.forEach((line, index) => page.drawText(line, {
    x,
    y: y - index * options.lineHeight,
    font: options.font,
    size: options.size,
    color: options.color,
  }));
  return y - lines.length * options.lineHeight;
}

function drawSectionHeading(page: PDFPage, title: string, y: number, bold: PDFFont): number {
  page.drawText(title.toUpperCase(), { x: MARGIN, y, font: bold, size: 10, color: TEAL });
  page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 8 }, thickness: 0.7, color: BORDER });
  return y - 30;
}

function drawField(page: PDFPage, label: string, value: string | number | null | undefined, x: number, y: number, regular: PDFFont, bold: PDFFont, width: number) {
  page.drawText(label, { x, y, font: regular, size: 8.5, color: MUTED });
  const lines = wrapText(pdfSafe(value), bold, 10.5, width);
  lines.slice(0, 2).forEach((line, index) => page.drawText(line, { x, y: y - 15 - index * 12, font: bold, size: 10.5, color: NAVY }));
}

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    return await readFile(new URL("../../app/icon.png", import.meta.url));
  } catch {
    return null;
  }
}

export async function generatePolicyPdf(data: PolicyPdfData): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await loadLogo();
  const text = getPolicyPdfText(data);

  if (logoBytes) {
    const logo = await document.embedPng(logoBytes);
    page.drawImage(logo, { x: MARGIN, y: 772, width: 38, height: 38 });
  }
  page.drawText("INSUREFLOW", { x: logoBytes ? 96 : MARGIN, y: 794, font: bold, size: 12, color: NAVY });
  page.drawText("Motor Policy Schedule", { x: logoBytes ? 96 : MARGIN, y: 776, font: regular, size: 10, color: MUTED });

  page.drawRectangle({ x: 401, y: 778, width: 146, height: 24, color: PALE_TEAL, borderColor: rgb(0.68, 0.87, 0.83), borderWidth: 0.7 });
  page.drawText("DEMONSTRATION POLICY", { x: 414, y: 786, font: bold, size: 8, color: TEAL });
  page.drawLine({ start: { x: MARGIN, y: 758 }, end: { x: PAGE_WIDTH - MARGIN, y: 758 }, thickness: 1.2, color: TEAL });

  page.drawText("Policy schedule", { x: MARGIN, y: 724, font: bold, size: 24, color: NAVY });
  page.drawText(pdfSafe(data.policy.policyNumber), { x: MARGIN, y: 698, font: bold, size: 12, color: TEAL });

  page.drawRectangle({ x: MARGIN, y: 622, width: PAGE_WIDTH - MARGIN * 2, height: 56, color: rgb(0.975, 0.985, 0.989), borderColor: BORDER, borderWidth: 0.7 });
  const summaryWidth = (PAGE_WIDTH - MARGIN * 2 - 36) / 4;
  drawField(page, "Status", text.status, MARGIN + 12, 661, regular, bold, summaryWidth);
  drawField(page, "Coverage", text.coverage, MARGIN + 12 + summaryWidth, 661, regular, bold, summaryWidth);
  drawField(page, "Start date", text.startDate, MARGIN + 12 + summaryWidth * 2, 661, regular, bold, summaryWidth);
  drawField(page, "End date", text.endDate, MARGIN + 12 + summaryWidth * 3, 661, regular, bold, summaryWidth);

  let y = drawSectionHeading(page, "Customer details", 598, bold);
  drawField(page, "Full name", data.customer.fullName, MARGIN, y, regular, bold, 220);
  drawField(page, "Email", data.customer.email, 310, y, regular, bold, 237);
  y -= 48;
  if (data.customer.phone) {
    drawField(page, "Phone", data.customer.phone, MARGIN, y, regular, bold, 220);
    y -= 48;
  }

  y = drawSectionHeading(page, "Vehicle details", y, bold);
  drawField(page, "Vehicle", `${data.vehicle.make} ${data.vehicle.model} (${data.vehicle.year})`, MARGIN, y, regular, bold, 220);
  drawField(page, "Bahrain plate number", data.vehicle.plateNumber, 310, y, regular, bold, 237);
  y -= 48;
  if (data.vehicle.vin) {
    drawField(page, "VIN", data.vehicle.vin, MARGIN, y, regular, bold, 220);
    y -= 48;
  }

  y = drawSectionHeading(page, "Coverage details", y, bold);
  drawField(page, "Coverage type", text.coverage, MARGIN, y, regular, bold, 140);
  drawField(page, "Coverage limit", text.coverageLimit, 218, y, regular, bold, 140);
  drawField(page, "Excess", text.excess, 388, y, regular, bold, 159);
  y -= 52;

  y = drawSectionHeading(page, "Simulated payment summary", y, bold);
  drawField(page, "Annual premium", text.annualPremium, MARGIN, y, regular, bold, 140);
  drawField(page, "Payment method", "Demo payment", 218, y, regular, bold, 140);
  drawField(page, "Payment status", "Simulated", 388, y, regular, bold, 159);
  y -= 48;
  page.drawText("No real financial transaction was processed.", { x: MARGIN, y, font: regular, size: 9, color: MUTED });
  y -= 34;

  page.drawRectangle({ x: MARGIN, y: y - 70, width: PAGE_WIDTH - MARGIN * 2, height: 82, color: rgb(0.985, 0.975, 0.94), borderColor: rgb(0.91, 0.84, 0.63), borderWidth: 0.7 });
  page.drawText("IMPORTANT DEMONSTRATION NOTICE", { x: MARGIN + 14, y: y - 8, font: bold, size: 8.5, color: NAVY });
  const noticeY = drawWrappedText(page, text.disclaimer, MARGIN + 14, y - 25, { font: regular, size: 8.3, color: NAVY, maxWidth: PAGE_WIDTH - MARGIN * 2 - 28, lineHeight: 11 });
  drawWrappedText(page, "Actual insurance products are subject to the terms and conditions of licensed insurance providers.", MARGIN + 14, noticeY - 3, { font: bold, size: 8.3, color: NAVY, maxWidth: PAGE_WIDTH - MARGIN * 2 - 28, lineHeight: 11 });

  page.drawLine({ start: { x: MARGIN, y: 42 }, end: { x: PAGE_WIDTH - MARGIN, y: 42 }, thickness: 0.5, color: BORDER });
  page.drawText("For demonstration terms, privacy information, and disclaimers, see the InsureFlow legal pages.", { x: MARGIN, y: 27, font: regular, size: 7.5, color: MUTED });
  page.drawText("1", { x: PAGE_WIDTH - MARGIN - 4, y: 27, font: regular, size: 7.5, color: MUTED });

  const bytes = await document.save({ useObjectStreams: true });
  if (bytes.byteLength >= POLICY_DOCUMENT_MAX_BYTES) {
    throw new Error("Generated policy document exceeds the configured storage limit.");
  }
  return bytes;
}
