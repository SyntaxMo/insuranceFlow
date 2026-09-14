// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HelpFaq } from "@/components/marketing/HelpFaq";

describe("landing page help and FAQ", () => {
  afterEach(cleanup);

  it("starts collapsed and can expand and collapse the FAQ list", async () => {
    const user = userEvent.setup();
    render(<HelpFaq />);
    const toggle = screen.getByRole("button", { name: "View FAQs" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Hide FAQs" }).getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Hide FAQs" }));
    expect(screen.getByRole("button", { name: "View FAQs" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps one concise answer open at a time", async () => {
    const user = userEvent.setup();
    render(<HelpFaq />);
    await user.click(screen.getByRole("button", { name: "View FAQs" }));
    const linkQuestion = screen.getByRole("button", { name: "How do I link an existing policy?" });
    const aiQuestion = screen.getByRole("button", { name: "Can AI approve or reject my claim?" });
    await user.click(linkQuestion);
    expect(linkQuestion.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/verification code sent to the policyholder's registered email/i)).toBeTruthy();
    await user.click(aiQuestion);
    expect(linkQuestion.getAttribute("aria-expanded")).toBe("false");
    expect(aiQuestion.getAttribute("aria-expanded")).toBe("true");
  });
});
