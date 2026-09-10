import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServerClientMock,
  createServiceRoleClientMock,
  redirectMock,
  revalidatePathMock,
  signUpMock,
  insertProfileMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  createServiceRoleClientMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  signUpMock: vi.fn(),
  insertProfileMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/auth/session", () => ({ routeForRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { signupAction } from "@/app/(auth)/actions";

function validFormData() {
  const formData = new FormData();
  formData.set("fullName", "Test Customer");
  formData.set("email", "customer@example.org");
  formData.set("phone", "+973 3000 0000");
  formData.set("password", "password1");
  formData.set("confirmPassword", "password1");
  return formData;
}

describe("signupAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerClientMock.mockResolvedValue({
      auth: { signUp: signUpMock, signOut: vi.fn() },
    });
    createServiceRoleClientMock.mockReturnValue({
      from: vi.fn(() => ({ insert: insertProfileMock })),
      auth: { admin: { deleteUser: vi.fn() } },
    });
    insertProfileMock.mockResolvedValue({ error: null });
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "auth-user-id", identities: [{ id: "identity-id" }] },
        session: { access_token: "test-token" },
      },
      error: null,
    });
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it("creates one CUSTOMER profile from the successful Auth user and redirects", async () => {
    await expect(signupAction({}, validFormData())).rejects.toThrow(
      "redirect:/dashboard",
    );

    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(insertProfileMock).toHaveBeenCalledWith({
      full_name: "Test Customer",
      email: "customer@example.org",
      phone: "+973 3000 0000",
      role: "CUSTOMER",
      auth_user_id: "auth-user-id",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("never calls Supabase when server validation rejects a mismatch", async () => {
    const formData = validFormData();
    formData.set("confirmPassword", "different1");

    const result = await signupAction({}, formData);

    expect(result.fields?.confirmPassword).toContain("Passwords do not match.");
    expect(signUpMock).not.toHaveBeenCalled();
    expect(insertProfileMock).not.toHaveBeenCalled();
  });
});
