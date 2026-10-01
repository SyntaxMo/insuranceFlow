// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profile: vi.fn(), redirect: vi.fn(), server: vi.fn(), service: vi.fn(), signIn: vi.fn(), lookup: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedProfile: m.profile, routeForRole: (role: string) => role === "CUSTOMER" ? "/dashboard" : "/admin" }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: m.server, createServiceRoleClient: m.service }));
vi.mock("@/components/auth/AuthForms", () => ({ LoginForm: ({ next }: { next?: string }) => <form noValidate aria-label="Sign in"><input type="hidden" name="next" value={next || ""} /></form> }));
import LoginPage from "./login/page";
import { loginAction } from "./actions";

describe("safe Settings email return", () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.profile.mockResolvedValue(null);
    m.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
    m.server.mockResolvedValue({ auth: { signInWithPassword: m.signIn } });
    m.signIn.mockResolvedValue({ data: { user: { id: "session-auth" } }, error: null });
    m.service.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.lookup }) }) }) });
    m.lookup.mockResolvedValue({ data: { role: "CUSTOMER" }, error: null });
  });
  afterEach(cleanup);
  it("preserves only the allowlisted destination in the signed-out form", async () => {
    const view = render(await LoginPage({ searchParams: Promise.resolve({ next: "settings" }) }));
    expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("next")).toBe("settings");
    view.unmount(); render(await LoginPage({ searchParams: Promise.resolve({ next: "https://evil.example" }) }));
    expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("next")).toBe("");
  });
  it("takes an already signed-in customer directly to Settings without cancelling anything", async () => {
    m.profile.mockResolvedValue({ role: "CUSTOMER" });
    await expect(LoginPage({ searchParams: Promise.resolve({ next: "settings" }) })).rejects.toThrow("redirect:/dashboard/settings?section=privacy");
    expect(m.service).not.toHaveBeenCalled();
  });
  it.each(["CUSTOMER", "CLAIMS_OFFICER", "ADMIN"])("uses the authenticated profile role for %s after sign-in", async role => {
    m.lookup.mockResolvedValue({ data: { role }, error: null });
    const form = new FormData(); form.set("email", "test@example.com"); form.set("password", "password1"); form.set("next", "settings"); form.set("role", "ADMIN");
    await expect(loginAction({}, form)).rejects.toThrow(`redirect:${role === "CUSTOMER" ? "/dashboard/settings?section=privacy" : "/admin"}`);
  });
  it("does not accept an arbitrary browser-supplied redirect", async () => {
    const form = new FormData(); form.set("email", "test@example.com"); form.set("password", "password1"); form.set("next", "https://evil.example");
    await expect(loginAction({}, form)).rejects.toThrow("redirect:/dashboard");
  });
});
