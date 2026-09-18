import { describe, expect, it, vi } from "vitest";

const { requireStaffMock } = vi.hoisted(() => ({ requireStaffMock: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireStaff: requireStaffMock }));

import AdminLayout from "@/app/admin/layout";

describe("AdminLayout", () => {
  it("resolves staff authorization before returning the workspace", async () => {
    requireStaffMock.mockResolvedValue({
      id: "officer",
      auth_user_id: "officer-auth",
      role: "CLAIMS_OFFICER",
    });
    const result = await AdminLayout({ children: <p>Claims workspace</p> });
    expect(requireStaffMock).toHaveBeenCalledOnce();
    expect(result.props.initialUserId).toBe("officer-auth");
    expect(result.props.initialRole).toBe("CLAIMS_OFFICER");
    expect(result.props.area).toBe("staff");
    expect(result.props.children.props.children).toBe("Claims workspace");
  });

  it("does not swallow customer or unauthenticated redirects", async () => {
    requireStaffMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(AdminLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT");
  });
});
