// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClaimHistory } from "@/components/claims/ClaimHistory";

afterEach(cleanup);

describe("ClaimHistory", () => {
  it("continues to render historical REVIEW_RETURNED events", () => {
    render(
      <ClaimHistory
        history={[
          {
            id: "history-1",
            action: "REVIEW_RETURNED",
            note: null,
            actorName: "Claims Officer",
            created_at: "2026-09-16T10:00:00Z",
          },
        ]}
        showActor
      />,
    );

    expect(screen.getByText("Returned to New")).toBeTruthy();
    expect(screen.getByText(/Claims Officer/)).toBeTruthy();
  });
});
