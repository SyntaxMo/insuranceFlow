// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiClaimAnalysis } from "@/components/admin/AiClaimAnalysis";
import type { ClaimAnalysisResult } from "@/types/ai-analysis";

const analysis: ClaimAnalysisResult = {
  summary: "The submitted claim describes a rear-end collision.",
  extractedInformation: {
    accidentDate: "2026-09-06",
    accidentLocation: "Manama",
    vehicle: "Toyota Camry (2024)",
    repairEstimateAmount: 500,
    policeReportNumber: null,
    policeReportDetails: null,
    visibleVehicleDamage: ["Rear bumper damage"],
    otherVehiclesMentioned: [],
    otherPartiesMentioned: [],
  },
  missingInformation: [],
  inconsistencies: [],
  riskFlags: [],
  model: "claim-model",
  updatedAt: "2026-09-16T10:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AiClaimAnalysis", () => {
  it("renders an existing analysis immediately without a new AI request", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<AiClaimAnalysis claimId="claim-1" initialAnalysis={analysis} />);
    expect(screen.getByText(analysis.summary)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Analyze with AI" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves the loading state and renders a successful new analysis", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ analysis }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<AiClaimAnalysis claimId="claim-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Analyze with AI" }));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByText(analysis.summary, {}, { timeout: 2_000 })).toBeTruthy();
    expect(screen.queryByText("Analyzing claim documents")).toBeNull();
  });

  it("leaves loading and offers retry after a provider failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "AI analysis is temporarily unavailable." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<AiClaimAnalysis claimId="claim-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Analyze with AI" }));
    expect(await screen.findByText("Analysis failed", {}, { timeout: 2_000 })).toBeTruthy();
    expect(screen.queryByText("Analyzing claim documents")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("handles a malformed successful response without remaining in loading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ analysis: { summary: "Incomplete" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<AiClaimAnalysis claimId="claim-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Analyze with AI" }));
    expect(
      await screen.findByText("The analysis response was not in the expected format.", {}, { timeout: 2_000 }),
    ).toBeTruthy();
    expect(screen.queryByText("Analyzing claim documents")).toBeNull();
  });

  it("retries from the error state and prevents duplicate concurrent requests", async () => {
    let resolveFirst: ((value: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ analysis }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    render(<AiClaimAnalysis claimId="claim-1" />);
    const analyzeButton = screen.getByRole("button", { name: "Analyze with AI" });
    fireEvent.click(analyzeButton);
    fireEvent.click(analyzeButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFirst?.(
      new Response(JSON.stringify({ error: "Temporary failure" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const retry = await screen.findByRole("button", { name: "Try again" }, { timeout: 2_000 });
    fireEvent.click(retry);
    expect(await screen.findByText(analysis.summary, {}, { timeout: 2_000 })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
