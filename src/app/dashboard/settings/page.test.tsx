// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ customer: vi.fn(), deletion: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCustomer: m.customer }));
vi.mock("@/lib/privacy/data-deletion", () => ({ getCustomerDataDeletionRequest: m.deletion }));
import SettingsPage, { metadata } from "./page";
describe("customer Settings", () => {
  beforeEach(() => { m.customer.mockResolvedValue({ id: "customer", email: "verified@example.com" }); m.deletion.mockResolvedValue({ request: null, unavailable: false }); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("contains security, essential-only cookie information and deletion controls", async () => {
    render(<main>{await SettingsPage()}</main>);
    expect(metadata.title).toBe("Settings | InsureFlow");
    for (const name of ["Settings", "Security", "Cookie preferences", "Privacy & data"]) expect(screen.getByRole("heading", { name })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change password" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Request data deletion" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View Cookie Policy" }).getAttribute("href")).toBe("/cookies");
    expect(screen.queryByRole("switch")).toBeNull(); expect(screen.getByText(/only essential cookies/)).toBeTruthy();
    expect(m.deletion).toHaveBeenCalledWith("customer");
  });
  it("shows processing without cancellation or a new-request button", async () => {
    m.deletion.mockResolvedValue({ request: { id: "request", status: "PROCESSING", createdAt: "2026-10-01", updatedAt: "2026-10-02", resolvedAt: null }, unavailable: false });
    render(await SettingsPage());
    expect(screen.getByText("Processing")).toBeTruthy(); expect(screen.getByText(/can no longer be cancelled/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cancel request|Request data deletion/ })).toBeNull();
  });
  it("respects customer authorization before loading data", async () => {
    m.customer.mockRejectedValue(new Error("NEXT_REDIRECT:/admin"));
    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT"); expect(m.deletion).not.toHaveBeenCalled();
  });
});
