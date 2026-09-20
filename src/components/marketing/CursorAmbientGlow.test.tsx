// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CursorAmbientGlow } from "@/components/marketing/CursorAmbientGlow";

function installMatchMedia({ finePointer = true, reducedMotion = false } = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : finePointer,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("CursorAmbientGlow", () => {
  beforeEach(() => {
    installMatchMedia();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("stays hidden until the first mouse movement, then follows without rerendering", () => {
    const { container } = render(<CursorAmbientGlow />);
    const glow = container.querySelector<HTMLElement>("[data-cursor-ambient-glow]");

    expect(glow?.dataset.visible).toBe("false");
    fireEvent.pointerMove(window, { clientX: 320, clientY: 180, pointerType: "mouse" });
    expect(glow?.dataset.visible).toBe("true");
    expect(glow?.style.transform).toBe(
      "translate3d(320px, 180px, 0) translate(-50%, -50%)",
    );
    expect(glow?.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not reveal for coarse-pointer devices", () => {
    installMatchMedia({ finePointer: false });
    const { container } = render(<CursorAmbientGlow />);
    const glow = container.querySelector<HTMLElement>("[data-cursor-ambient-glow]");

    fireEvent.pointerMove(window, { clientX: 320, clientY: 180, pointerType: "mouse" });
    expect(glow?.dataset.visible).toBe("false");
  });

  it("does not reveal when reduced motion is requested", () => {
    installMatchMedia({ reducedMotion: true });
    const { container } = render(<CursorAmbientGlow />);
    const glow = container.querySelector<HTMLElement>("[data-cursor-ambient-glow]");

    fireEvent.pointerMove(window, { clientX: 320, clientY: 180, pointerType: "mouse" });
    expect(glow?.dataset.visible).toBe("false");
  });
});
