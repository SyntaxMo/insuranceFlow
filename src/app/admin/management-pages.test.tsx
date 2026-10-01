// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ admin: vi.fn(), staff: vi.fn(), requests: vi.fn(), officers: vi.fn(), overview: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/auth/admin", () => ({ requireAdmin: m.admin }));
vi.mock("@/lib/auth/session", () => ({ requireStaff: m.staff }));
vi.mock("@/lib/admin/accounts", () => ({ listDeletionRequests: m.requests, listClaimsOfficers: m.officers, getAdminOverview: m.overview, ADMIN_PAGE_SIZE: 25, adminPageNumber: (value?: string) => Number(value) || 1 }));
vi.mock("./management-actions", () => ({ transitionDeletionRequestAction: vi.fn(), updateClaimsOfficerAction: vi.fn() }));
import AdminPage from "./page";
import RequestsPage from "./deletion-requests/page";
import OfficersPage from "./claims-officers/page";
describe("bounded ADMIN pages", () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.admin.mockResolvedValue({ role: "ADMIN" }); m.staff.mockResolvedValue({ role: "ADMIN" });
    m.overview.mockResolvedValue({ pending: 2, officers: 1 });
    m.requests.mockResolvedValue({ requests: [], count: 0, error: null });
    m.officers.mockResolvedValue({ officers: [{ id: "internal-profile-reference", fullName: "Officer Name", email: "work@example.com", createdAt: "2026-09-12" }], count: 1, error: null });
    m.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
  });
  afterEach(cleanup);
  it("shows a small admin overview and preserves the officer landing redirect", async () => {
    render(await AdminPage()); expect(screen.getByRole("heading", { level: 1, name: "Admin" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View deletion requests" }).getAttribute("href")).toBe("/admin/deletion-requests");
    m.staff.mockResolvedValue({ role: "CLAIMS_OFFICER" }); await expect(AdminPage()).rejects.toThrow("redirect:/admin/claims");
  });
  it.each([RequestsPage, OfficersPage])("rejects management pages before data is loaded", async Page => {
    m.admin.mockRejectedValue(new Error("redirect:/admin/claims"));
    await expect(Page()).rejects.toThrow("redirect:/admin/claims"); expect(m.requests).not.toHaveBeenCalled(); expect(m.officers).not.toHaveBeenCalled();
  });
  it("renders readable staff identity with no privileged data or passwords", async () => {
    render(await OfficersPage());
    expect(screen.getByRole("table", { name: "Claims Officer accounts" })).toBeTruthy();
    for (const text of ["Officer Name", "work@example.com", "Claims Officer", "Sep 12, 2026"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
    expect(screen.queryByText("internal-profile-reference")).toBeNull(); expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
  it("renders minimal request details, resolution and no action for terminal history", async () => {
    m.requests.mockResolvedValue({ requests: [{ id: "request", status: "COMPLETED", customerName: "Customer", customerEmail: "account@example.com", createdAt: "2026-10-01", reason: "Demo cleanup", resolvedAt: "2026-10-02", resolutionNote: "Metadata only" }], count: 1, error: null });
    render(await RequestsPage()); expect(screen.getByText("Completed")).toBeTruthy(); expect(screen.getByText("Resolution: Metadata only")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
