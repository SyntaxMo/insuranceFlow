// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublicCookieNotice } from "@/components/privacy/PublicCookieNotice";
import {
  COOKIE_NOTICE_STORAGE_KEY,
  COOKIE_NOTICE_VERSION,
} from "@/lib/privacy/cookie-notice";

describe("PublicCookieNotice", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("appears on a first visit without fake optional-cookie controls", async () => {
    render(<PublicCookieNotice />);
    expect(await screen.findByRole("complementary", { name: "Cookies on InsureFlow" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cookie policy" }).getAttribute("href")).toBe("/cookies");
    expect(screen.queryByRole("button", { name: /accept all/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reject all/i })).toBeNull();
  });

  it("stores only the current-version acknowledgement and disappears", async () => {
    const user = userEvent.setup();
    render(<PublicCookieNotice />);
    await user.click(await screen.findByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("complementary", { name: "Cookies on InsureFlow" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) ?? "{}")).toEqual({
      acknowledged: true,
      version: COOKIE_NOTICE_VERSION,
    });
    expect(window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY)).not.toMatch(
      /email|phone|user|claim|policy/i,
    );
  });

  it("stays hidden on a return visit with the current acknowledgement", async () => {
    window.localStorage.setItem(
      COOKIE_NOTICE_STORAGE_KEY,
      JSON.stringify({ acknowledged: true, version: COOKIE_NOTICE_VERSION }),
    );
    render(<PublicCookieNotice />);
    await waitFor(() => {
      expect(screen.queryByText("Cookies on InsureFlow")).toBeNull();
    });
  });

  it("appears again when the stored policy version is outdated", async () => {
    window.localStorage.setItem(
      COOKIE_NOTICE_STORAGE_KEY,
      JSON.stringify({ acknowledged: true, version: COOKIE_NOTICE_VERSION - 1 }),
    );
    render(<PublicCookieNotice />);
    expect(await screen.findByText("Cookies on InsureFlow")).toBeTruthy();
  });

  it("supports keyboard acknowledgement without trapping focus", async () => {
    const user = userEvent.setup();
    render(<PublicCookieNotice />);
    const button = await screen.findByRole("button", { name: "Got it" });
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter}");
    expect(screen.queryByText("Cookies on InsureFlow")).toBeNull();
  });
});
