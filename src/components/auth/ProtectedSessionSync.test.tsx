// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  unsubscribe: vi.fn(),
  authCallback: null as
    | ((event: AuthChangeEvent, session: Session | null) => void)
    | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks,
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      onAuthStateChange: (
        callback: (event: AuthChangeEvent, session: Session | null) => void,
      ) => {
        mocks.authCallback = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  }),
}));

import { ProtectedSessionSync } from "@/components/auth/ProtectedSessionSync";

function sessionFor(userId: string): Session {
  return { user: { id: userId } } as Session;
}

function profileResponse(userId: string, role: "CUSTOMER" | "CLAIMS_OFFICER" | "ADMIN") {
  return {
    ok: true,
    json: async () => ({ authenticated: true, userId, role }),
  } as Response;
}

describe("ProtectedSessionSync", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authCallback = null;
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("hides stale officer UI and routes an officer-to-customer switch to the dashboard", async () => {
    fetchMock.mockResolvedValue(profileResponse("customer-auth", "CUSTOMER"));
    render(
      <ProtectedSessionSync
        initialUserId="officer-auth"
        initialRole="CLAIMS_OFFICER"
        area="staff"
      >
        <p>Officer actions</p>
      </ProtectedSessionSync>,
    );

    act(() => mocks.authCallback?.("SIGNED_IN", sessionFor("customer-auth")));

    expect(screen.queryByText("Officer actions")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Updating session...");
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("routes a customer-to-officer switch to the staff area", async () => {
    fetchMock.mockResolvedValue(profileResponse("officer-auth", "CLAIMS_OFFICER"));
    render(
      <ProtectedSessionSync
        initialUserId="customer-auth"
        initialRole="CUSTOMER"
        area="customer"
      >
        <p>Customer data</p>
      </ProtectedSessionSync>,
    );

    act(() => mocks.authCallback?.("SIGNED_IN", sessionFor("officer-auth")));

    expect(screen.queryByText("Customer data")).toBeNull();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin"));
  });

  it("immediately hides protected content and routes to login on sign out", () => {
    render(
      <ProtectedSessionSync
        initialUserId="customer-auth"
        initialRole="CUSTOMER"
        area="customer"
      >
        <p>Protected customer data</p>
      </ProtectedSessionSync>,
    );

    act(() => mocks.authCallback?.("SIGNED_OUT", null));

    expect(screen.queryByText("Protected customer data")).toBeNull();
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("detects a server-driven cross-tab account switch when the tab regains focus", async () => {
    fetchMock.mockResolvedValue(profileResponse("customer-auth", "CUSTOMER"));
    render(
      <ProtectedSessionSync
        initialUserId="officer-auth"
        initialRole="CLAIMS_OFFICER"
        area="staff"
      >
        <p>Officer actions</p>
      </ProtectedSessionSync>,
    );

    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("Officer actions")).toBeNull();
  });

  it("detects a server-driven cross-tab sign-out when the tab regains focus", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false }),
    } as Response);
    render(
      <ProtectedSessionSync
        initialUserId="customer-auth"
        initialRole="CUSTOMER"
        area="customer"
      >
        <p>Protected customer data</p>
      </ProtectedSessionSync>,
    );

    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Protected customer data")).toBeNull();
  });

  it("does not reload or redirect for a same-user, same-role token refresh", async () => {
    fetchMock.mockResolvedValue(profileResponse("customer-auth", "CUSTOMER"));
    render(
      <ProtectedSessionSync
        initialUserId="customer-auth"
        initialRole="CUSTOMER"
        area="customer"
      >
        <p>Customer data</p>
      </ProtectedSessionSync>,
    );

    act(() => mocks.authCallback?.("TOKEN_REFRESHED", sessionFor("customer-auth")));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByText("Customer data")).toBeTruthy();
  });

  it("revalidates a changed application role for the same auth user", async () => {
    fetchMock.mockResolvedValue(profileResponse("shared-auth", "ADMIN"));
    render(
      <ProtectedSessionSync
        initialUserId="shared-auth"
        initialRole="CUSTOMER"
        area="customer"
      >
        <p>Customer data</p>
      </ProtectedSessionSync>,
    );

    act(() => mocks.authCallback?.("TOKEN_REFRESHED", sessionFor("shared-auth")));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin"));
    expect(screen.queryByText("Customer data")).toBeNull();
  });

  it("unsubscribes from auth changes when the protected layout unmounts", () => {
    const view = render(
      <ProtectedSessionSync
        initialUserId="customer-auth"
        initialRole="CUSTOMER"
        area="customer"
      >
        <p>Customer data</p>
      </ProtectedSessionSync>,
    );

    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
