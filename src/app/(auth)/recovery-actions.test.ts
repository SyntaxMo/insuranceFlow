import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { auth, recovery, clear } = vi.hoisted(() => ({
  auth: { resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() },
  recovery: vi.fn(), clear: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({ auth }) }));
vi.mock("@/lib/auth/recovery", () => ({ getRecoveryClient: recovery, clearRecoveryAuthorization: clear }));
import { requestPasswordReset, resetPassword } from "./recovery-actions";
function form(values: Record<string, string>) { const data = new FormData(); Object.entries(values).forEach(([k,v]) => data.set(k,v)); return data; }
beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = "https://insureflow.example";
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  auth.updateUser.mockResolvedValue({ data: { user: { id: "customer", app_metadata: { role: "CUSTOMER" } } }, error: null });
  recovery.mockResolvedValue({ auth });
});
it("requests native recovery with normalized email and production callback", async () => {
  const result = await requestPasswordReset({}, form({ email: " Customer@Example.com " }));
  expect(result.success).toBe(true);
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("customer@example.com", { redirectTo: "https://insureflow.example/auth/callback?intent=recovery" });
});
it("returns identical responses for existing and unknown accounts and provider failures", async () => {
  const known = await requestPasswordReset({}, form({ email: "known@example.com" }));
  auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: { message: "account missing or limited", status: 429 } });
  expect(await requestPasswordReset({}, form({ email: "unknown@example.com" }))).toEqual(known);
  auth.resetPasswordForEmail.mockRejectedValue(new Error("raw provider details"));
  expect(await requestPasswordReset({}, form({ email: "unknown@example.com" }))).toEqual(known);
});
it("rejects invalid email before requesting recovery", async () => {
  expect((await requestPasswordReset({}, form({ email: "invalid" }))).fields?.email).toBeTruthy();
  expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
});
it("rejects direct password mutation without verified recovery", async () => {
  recovery.mockResolvedValue(null);
  expect((await resetPassword({}, form({ password: "password123", confirmPassword: "password123", userId: "victim" }))).success).not.toBe(true);
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it("rejects mismatched and short passwords before update", async () => {
  expect((await resetPassword({}, form({ password: "password123", confirmPassword: "other" }))).fields?.confirmPassword).toEqual(["Passwords do not match."]);
  expect((await resetPassword({}, form({ password: "short", confirmPassword: "short" }))).fields?.password).toBeTruthy();
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it.each(["CUSTOMER", "CLAIMS_OFFICER", "ADMIN"])("updates only the recovery password for %s without metadata changes", async (role) => {
  auth.updateUser.mockResolvedValue({ data: { user: { app_metadata: { role } } }, error: null });
  expect((await resetPassword({}, form({ password: "password123", confirmPassword: "password123", role: "ADMIN", userId: "victim" }))).success).toBe(true);
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "password123" });
  expect(clear).toHaveBeenCalledOnce();
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("keeps recovery usable and sanitizes a rejected update", async () => {
  auth.updateUser.mockResolvedValue({ error: { message: "raw sensitive infrastructure", code: "weak_password" } });
  const result = await resetPassword({}, form({ password: "password123", confirmPassword: "password123" }));
  expect(result.success).not.toBe(true);
  expect(JSON.stringify(result)).not.toContain("raw sensitive");
  expect(clear).not.toHaveBeenCalled();
});
