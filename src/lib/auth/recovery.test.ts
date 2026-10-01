import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { store, auth } = vi.hoisted(() => ({
  store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  auth: { getUser: vi.fn(), getClaims: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({ auth }) }));
import { issueRecoveryAuthorization, getRecoveryClient, hasRecentRecoveryMethod } from "./recovery";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.OTP_HASH_SECRET = "test-recovery-secret";
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a", session_id: "session-a" } }, error: null });
  store.get.mockReturnValue(undefined);
});
it("rejects a normal authenticated session without callback authorization", async () => {
  expect(await getRecoveryClient()).toBeNull();
});
it("rejects authorization after the authenticated session expires", async () => {
  await issueRecoveryAuthorization({ sub: "user-a", session_id: "session-a" });
  store.get.mockReturnValue({ value: store.set.mock.calls[0][1] });
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_not_found" } });
  expect(await getRecoveryClient()).toBeNull();
});
it("binds callback authorization to the verified user and session", async () => {
  await issueRecoveryAuthorization({ sub: "user-a", session_id: "session-a" });
  const [key, value, options] = store.set.mock.calls[0];
  expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 900 });
  store.get.mockImplementation((name) => name === key ? { value } : undefined);
  expect(await getRecoveryClient()).not.toBeNull();
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a", session_id: "other-session" } }, error: null });
  expect(await getRecoveryClient()).toBeNull();
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-b" } }, error: null });
  expect(await getRecoveryClient()).toBeNull();
});
it("rejects modified and expired authorization", async () => {
  await issueRecoveryAuthorization({ sub: "user-a", session_id: "session-a" });
  const value = store.set.mock.calls[0][1];
  store.get.mockReturnValue({ value: value + "tampered" });
  expect(await getRecoveryClient()).toBeNull();
  store.get.mockReturnValue({ value });
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 901000);
  expect(await getRecoveryClient()).toBeNull();
  vi.useRealTimers();
});
it("requires a recent provider-signed recovery method, not ordinary login or metadata", () => {
  const timestamp = Math.floor(Date.now() / 1000);
  expect(hasRecentRecoveryMethod({ amr: [{ method: "recovery", timestamp }] })).toBe(true);
  expect(hasRecentRecoveryMethod({ amr: [{ method: "password", timestamp }], user_metadata: { recovery: true } })).toBe(false);
  expect(hasRecentRecoveryMethod({ amr: [{ method: "recovery", timestamp: timestamp - 901 }] })).toBe(false);
});
