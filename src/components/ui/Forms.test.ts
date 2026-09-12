import { describe, expect, it } from "vitest";
import { buttonClassName } from "@/components/ui/Forms";

describe("shared customer button styles", () => {
  it("keeps primary actions teal with white text", () => {
    const classes = buttonClassName("primary");
    expect(classes).toContain("bg-[var(--brand-teal)]");
    expect(classes).toContain("text-white");
    expect(classes).toContain("hover:text-white");
    expect(classes).toContain("focus-visible:text-white");
    expect(classes).toContain("active:text-white");
    expect(classes).toContain("disabled:text-white");
    expect(classes).not.toContain("text-[var(--brand-navy)]");
  });

  it("uses navy outlined secondary and red outlined destructive styles", () => {
    expect(buttonClassName("secondary")).toContain("text-[var(--brand-navy)]");
    expect(buttonClassName("secondary")).toContain("border-slate-300");
    expect(buttonClassName("danger")).toContain("text-rose-700");
    expect(buttonClassName("danger")).toContain("border-rose-300");
  });
});
