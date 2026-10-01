// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicCookieNotice } from "@/components/privacy/PublicCookieNotice";
import { HeroCoverageStory } from "@/components/marketing/HeroCoverageStory";
import {
  COOKIE_NOTICE_STORAGE_KEY,
  COOKIE_NOTICE_VERSION,
} from "@/lib/privacy/cookie-notice";

describe("PublicCookieNotice", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("appears on a first visit without fake optional-cookie controls", async () => {
    render(<PublicCookieNotice />);
    const notice = await screen.findByRole("complementary", { name: "Cookies on InsureFlow" });
    expect(notice.className).toContain("cookie-notice-enter");
    expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cookie policy" }).getAttribute("href")).toBe("/cookies");
    expect(screen.queryByRole("button", { name: /accept all/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reject all/i })).toBeNull();
  });

  it("stores only the current-version acknowledgement and disappears", async () => {
    const user = userEvent.setup();
    render(<PublicCookieNotice />);
    await user.click(await screen.findByRole("button", { name: "Got it" }));
    expect(
      screen.getByRole("complementary", { name: "Cookies on InsureFlow" }).className,
    ).toContain("cookie-notice-exit");
    expect(JSON.parse(window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) ?? "{}")).toEqual({
      acknowledged: true,
      version: COOKIE_NOTICE_VERSION,
    });
    expect(window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY)).not.toMatch(
      /email|phone|user|claim|policy/i,
    );
    await waitFor(() => {
      expect(screen.queryByRole("complementary", { name: "Cookies on InsureFlow" })).toBeNull();
    });
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
    await waitFor(() => {
      expect(screen.queryByText("Cookies on InsureFlow")).toBeNull();
    });
  });

  it("hands keyboard focus to neutral document context and leaves the next Tab usable", async () => {
    const user = userEvent.setup();
    render(<><a href="/login">Sign in</a><PublicCookieNotice /><a href="/privacy">Privacy</a></>);
    vi.spyOn(screen.getByRole("link", { name: "Sign in" }), "getBoundingClientRect").mockReturnValue({ top: 10, bottom: 40, left: 0, right: 80, width: 80, height: 30, x: 0, y: 10, toJSON() {} });
    vi.spyOn(screen.getByRole("link", { name: "Privacy" }), "getBoundingClientRect").mockReturnValue({ top: 5000, bottom: 5030, left: 0, right: 80, width: 80, height: 30, x: 0, y: 5000, toJSON() {} });
    const focus = vi.spyOn(document.body, "focus");
    await screen.findByRole("button", { name: "Got it" });
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(document.body);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(document.body.hasAttribute("tabindex")).toBe(false);
    await waitFor(() => expect(screen.queryByText("Cookies on InsureFlow")).toBeNull());
    expect(document.activeElement).toBe(document.body);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Sign in" }));
  });

  it("removes the notice without an animation delay when reduced motion is requested", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true }),
    );
    const user = userEvent.setup();
    render(<PublicCookieNotice />);
    await user.click(await screen.findByRole("button", { name: "Got it" }));
    await waitFor(() => {
      expect(screen.queryByText("Cookies on InsureFlow")).toBeNull();
    });
  });

  it.each(["pointer", "Enter", "Space"])("%s dismissal never focuses a hero hotspot or opens its comparison card", async (activation) => {
    const user = userEvent.setup();
    render(<><HeroCoverageStory /><PublicCookieNotice /><a href="/privacy">Privacy</a></>);
    const near = screen.getByRole("button", { name: "Compare Front bumper Compare both coverage example" });
    const far = screen.getByRole("link", { name: "Privacy" });
    vi.spyOn(near, "getBoundingClientRect").mockReturnValue({ top: 10, bottom: 40, height: 30 } as DOMRect);
    vi.spyOn(far, "getBoundingClientRect").mockReturnValue({ top: 5000, bottom: 5030, height: 30 } as DOMRect);
    const nearFocus = vi.spyOn(near, "focus");
    const farFocus = vi.spyOn(far, "focus");
    const bodyFocus = vi.spyOn(document.body, "focus");
    const button = await screen.findByRole("button", { name: "Got it" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    if (activation === "pointer") await user.click(button);
    else {
      button.focus();
      await user.keyboard(activation === "Enter" ? "{Enter}" : " ");
    }
    expect(nearFocus).not.toHaveBeenCalled();
    expect(farFocus).not.toHaveBeenCalled();
    expect(bodyFocus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(near.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tooltip")).toBeNull();
    await waitFor(() => expect(screen.queryByText("Cookies on InsureFlow")).toBeNull());
    expect(document.activeElement).toBe(document.body);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY)).not.toBeNull();
  });
});
