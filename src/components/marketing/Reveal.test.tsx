// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "@/components/marketing/Reveal";

describe("landing-page reveal motion", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reveals content when it enters the viewport", () => {
    let callback: IntersectionObserverCallback = () => undefined;
    class Observer {
      constructor(next: IntersectionObserverCallback) { callback = next; }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    vi.stubGlobal("IntersectionObserver", Observer);
    render(<Reveal><p>Reveal me</p></Reveal>);
    const reveal = screen.getByText("Reveal me").parentElement!;
    expect(reveal.getAttribute("data-visible")).toBe("false");
    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(reveal.getAttribute("data-visible")).toBe("true");
  });

  it("shows content without observation when reduced motion is preferred", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    render(<Reveal><p>Reduced motion content</p></Reveal>);
    await vi.waitFor(() => expect(screen.getByText("Reduced motion content").parentElement?.getAttribute("data-visible")).toBe("true"));
  });
});
