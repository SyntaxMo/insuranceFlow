import "server-only";

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  getProfileByAuthUserId,
  routeForRole,
} from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

type ConfirmationFailure =
  | "expired-confirmation"
  | "invalid-confirmation"
  | "missing-profile"
  | "session-exchange";

function failureRedirect(
  request: NextRequest,
  reason: ConfirmationFailure,
): NextResponse {
  const destination = new URL("/login", request.url);
  destination.searchParams.set("error", reason);
  return NextResponse.redirect(destination);
}

function looksExpired(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("expired") || normalized.includes("otp_expired");
}

export async function handleAuthConfirmation(
  request: NextRequest,
): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error) {
      console.error("Email confirmation code exchange failed:", error.message);
      return failureRedirect(
        request,
        looksExpired(error.message) ? "expired-confirmation" : "session-exchange",
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      console.error("Email confirmation token verification failed:", error.message);
      return failureRedirect(
        request,
        looksExpired(error.message) ? "expired-confirmation" : "invalid-confirmation",
      );
    }
  } else {
    return failureRedirect(request, "invalid-confirmation");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error(
      "Email confirmation session validation failed:",
      userError?.message || "No authenticated user returned",
    );
    return failureRedirect(request, "session-exchange");
  }

  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) {
    await supabase.auth.signOut();
    return failureRedirect(request, "missing-profile");
  }

  const destination = new URL(routeForRole(profile.role), request.url);
  if (profile.role === "CUSTOMER") {
    destination.searchParams.set("confirmed", "1");
  }
  return NextResponse.redirect(destination);
}
