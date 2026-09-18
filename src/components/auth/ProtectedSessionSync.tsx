"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

type ProtectedArea = "customer" | "staff";

type SessionProfileResponse =
  | { authenticated: false }
  | { authenticated: true; userId: string; role: UserRole };

type ProtectedSessionSyncProps = {
  children: React.ReactNode;
  initialUserId: string;
  initialRole: UserRole;
  area: ProtectedArea;
};

const PROFILE_ENDPOINT = "/api/auth/session-profile";
const PROFILE_CHECK_THROTTLE_MS = 1_000;

function destinationForRole(role: UserRole): "/dashboard" | "/admin" {
  return role === "CUSTOMER" ? "/dashboard" : "/admin";
}

function roleMatchesArea(role: UserRole, area: ProtectedArea): boolean {
  return area === "customer"
    ? role === "CUSTOMER"
    : role === "CLAIMS_OFFICER" || role === "ADMIN";
}

export function ProtectedSessionSync({
  children,
  initialUserId,
  initialRole,
  area,
}: ProtectedSessionSyncProps) {
  const router = useRouter();
  const [isRevalidating, setIsRevalidating] = useState(false);
  const identityRef = useRef({ userId: initialUserId, role: initialRole });
  const abortRef = useRef<AbortController | null>(null);
  const lastCheckAtRef = useRef(0);
  const mountedRef = useRef(true);

  const navigateTo = useCallback(
    (destination: "/login" | "/dashboard" | "/admin") => {
      if (!mountedRef.current) return;
      setIsRevalidating(true);
      router.replace(destination);
      router.refresh();
    },
    [router],
  );

  const resolveCurrentProfile = useCallback(
    async ({
      hintedUserId,
      hideImmediately = false,
      throttle = false,
    }: {
      hintedUserId?: string | null;
      hideImmediately?: boolean;
      throttle?: boolean;
    } = {}) => {
      const now = Date.now();
      if (throttle && now - lastCheckAtRef.current < PROFILE_CHECK_THROTTLE_MS) {
        return;
      }
      lastCheckAtRef.current = now;

      const previous = identityRef.current;
      const identityHintChanged =
        hintedUserId !== undefined && hintedUserId !== previous.userId;
      if (hideImmediately || identityHintChanged) setIsRevalidating(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(PROFILE_ENDPOINT, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Session profile request failed");

        const profile = (await response.json()) as SessionProfileResponse;
        if (!mountedRef.current || controller.signal.aborted) return;

        if (!profile.authenticated) {
          navigateTo("/login");
          return;
        }

        const identityChanged = profile.userId !== previous.userId;
        const roleChanged = profile.role !== previous.role;
        const wrongProtectedArea = !roleMatchesArea(profile.role, area);
        identityRef.current = { userId: profile.userId, role: profile.role };

        if (identityChanged || roleChanged || wrongProtectedArea) {
          navigateTo(destinationForRole(profile.role));
          return;
        }

        setIsRevalidating(false);
      } catch (error) {
        if (!mountedRef.current || controller.signal.aborted) return;
        // A server refresh keeps the protected server layout authoritative if
        // the lightweight profile endpoint is temporarily unavailable.
        if (hideImmediately || identityHintChanged) {
          router.refresh();
          return;
        }
        console.error(
          "Protected session revalidation failed.",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    },
    [area, navigateTo, router],
  );

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createBrowserClient();
    const deferredChecks = new Set<number>();

    const deferProfileCheck = (
      event: AuthChangeEvent,
      session: Session | null,
    ) => {
      const hintedUserId = session?.user.id ?? null;

      if (event === "SIGNED_OUT") {
        abortRef.current?.abort();
        navigateTo("/login");
        return;
      }

      const identityChanged = hintedUserId !== identityRef.current.userId;
      if (identityChanged) setIsRevalidating(true);

      const shouldResolve =
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED";

      if (!shouldResolve) return;

      // Supabase recommends keeping onAuthStateChange callbacks synchronous.
      // Deferring avoids making another async request while the auth lock is held.
      const timeoutId = window.setTimeout(() => {
        deferredChecks.delete(timeoutId);
        void resolveCurrentProfile({
          hintedUserId,
          hideImmediately: identityChanged,
          throttle: event === "SIGNED_IN" && !identityChanged,
        });
      }, 0);
      deferredChecks.add(timeoutId);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(deferProfileCheck);

    const checkAfterTabActivity = () => {
      if (document.visibilityState === "visible") {
        void resolveCurrentProfile({ throttle: true });
      }
    };
    window.addEventListener("focus", checkAfterTabActivity);
    window.addEventListener("pageshow", checkAfterTabActivity);
    document.addEventListener("visibilitychange", checkAfterTabActivity);

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      deferredChecks.forEach((timeoutId) => window.clearTimeout(timeoutId));
      subscription.unsubscribe();
      window.removeEventListener("focus", checkAfterTabActivity);
      window.removeEventListener("pageshow", checkAfterTabActivity);
      document.removeEventListener("visibilitychange", checkAfterTabActivity);
    };
  }, [navigateTo, resolveCurrentProfile]);

  if (isRevalidating) {
    return (
      <div
        className="fixed inset-0 z-[100] grid place-items-center bg-slate-50/95 px-4 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-[var(--brand-navy)] shadow-sm">
          <span
            className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand-teal)] motion-reduce:animate-none"
            aria-hidden="true"
          />
          Updating session...
        </div>
      </div>
    );
  }

  return children;
}
