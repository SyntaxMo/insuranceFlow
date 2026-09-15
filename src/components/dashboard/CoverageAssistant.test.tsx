// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoverageAssistant } from "@/components/dashboard/CoverageAssistant";

const comprehensiveRecommendation = {
  recommendedCoverage: "COMPREHENSIVE",
  headline: "Comprehensive may suit you better",
  summary: "Your answers suggest that protecting your own vehicle matters to you.",
  reasons: ["You prefer broader protection.", "You would rather have help with major repairs."],
  comparisonNote: "Third Party mainly focuses on liability to other people and property.",
  confidence: "high",
};

async function answerQuestions(user: ReturnType<typeof userEvent.setup>) {
  const choices = [
    "Very important",
    "Broader protection",
    "I would prefer insurance to help cover it",
    "My vehicle and liability to others",
    "I prefer stronger protection and predictability",
  ];
  for (let index = 0; index < choices.length; index += 1) {
    await user.click(screen.getByLabelText(choices[index]));
    await user.click(screen.getByRole("button", { name: index === choices.length - 1 ? "Continue" : "Next question" }));
  }
}

describe("CoverageAssistant", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recommendation: comprehensiveRecommendation }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens as an optional MCQ guide and preserves answers when closed", async () => {
    const user = userEvent.setup();
    render(<CoverageAssistant vehicle={{ make: "Toyota", model: "Corolla", year: 2026, estimatedValue: 9500 }} selectedCoverage="THIRD_PARTY" onAccept={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Help me choose" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Help me choose" })).toBeTruthy();
    await user.click(screen.getByLabelText("Very important"));
    await user.click(screen.getByRole("button", { name: "Close coverage assistant" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(trigger);
    expect((screen.getByLabelText("Very important") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/current manual selection is Third Party/i)).toBeTruthy();
  });

  it("polishes vehicle casing for display without changing request data", async () => {
    const user = userEvent.setup();
    render(<CoverageAssistant vehicle={{ make: "Kia", model: "sorento", year: 2026, estimatedValue: 9500 }} selectedCoverage={null} onAccept={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Help me choose" }));
    expect(screen.getByText("Kia Sorento · 2026")).toBeTruthy();
  });

  it("allows an empty note, shows real-request loading, and applies only an accepted recommendation", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    let resolveFetch: ((value: Response | PromiseLike<Response>) => void) | undefined;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }) as Promise<Response>);
    render(<CoverageAssistant vehicle={{ make: "Toyota", model: "Corolla", year: 2026, estimatedValue: 9500 }} selectedCoverage={null} onAccept={onAccept} />);
    await user.click(screen.getByRole("button", { name: "Help me choose" }));
    await answerQuestions(user);
    expect((screen.getByLabelText(/Additional context/) as HTMLTextAreaElement).value).toBe("");
    await user.click(screen.getByRole("button", { name: "Get recommendation" }));
    expect(screen.getByRole("status").textContent).toContain("Finding the best fit for you");
    expect(onAccept).not.toHaveBeenCalled();

    resolveFetch?.({ ok: true, json: async () => ({ recommendation: comprehensiveRecommendation }) } as Response);
    expect(await screen.findByRole("button", { name: "Use Comprehensive" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Use Comprehensive" }));
    expect(onAccept).toHaveBeenCalledWith("COMPREHENSIVE");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps manual control on Choose myself and provides a non-blocking failure fallback", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "safe" }) } as Response);
    render(<CoverageAssistant vehicle={{ make: "Toyota", model: "Corolla", year: 2026, estimatedValue: 9500 }} selectedCoverage="THIRD_PARTY" onAccept={onAccept} />);
    await user.click(screen.getByRole("button", { name: "Help me choose" }));
    await answerQuestions(user);
    await user.click(screen.getByRole("button", { name: "Get recommendation" }));
    expect(await screen.findByText("We couldn't generate a recommendation right now.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back to coverage" }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("retries immediately with the same answers and note while preserving manual selection", async () => {
    const user = userEvent.setup();
    let resolveRetry: ((value: Response | PromiseLike<Response>) => void) | undefined;
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "safe" }) } as Response)
      .mockReturnValueOnce(new Promise((resolve) => { resolveRetry = resolve; }) as Promise<Response>);
    render(<CoverageAssistant vehicle={{ make: "Kia", model: "sorento", year: 2026, estimatedValue: 9500 }} selectedCoverage="THIRD_PARTY" onAccept={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Help me choose" }));
    await answerQuestions(user);
    await user.type(screen.getByLabelText(/Additional context/), "I drive daily.");
    expect(screen.getByText(/current manual selection is Third Party/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Get recommendation" }));
    expect(await screen.findByText("We couldn't generate a recommendation right now.")).toBeTruthy();

    const firstBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("status").textContent).toContain("Finding the best fit for you");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
    expect(secondBody).toEqual(firstBody);
    expect(secondBody.optionalNote).toBe("I drive daily.");
    expect(secondBody.vehicle.model).toBe("sorento");

    resolveRetry?.({ ok: true, json: async () => ({ recommendation: comprehensiveRecommendation }) } as Response);
    expect(await screen.findByRole("button", { name: "Use Comprehensive" })).toBeTruthy();
  });
});
