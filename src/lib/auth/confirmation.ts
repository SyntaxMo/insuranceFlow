import "server-only";

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  getProfileByAuthUserId,
  routeForRole,
  synchronizeVerifiedProfileEmail,
} from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { clearRecoveryAuthorization, hasRecentRecoveryMethod, issueRecoveryAuthorization } from "@/lib/auth/recovery";

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
  const recoveryIntent = type === "recovery" || request.nextUrl.searchParams.get("intent") === "recovery";
  const recoveryFailure = async () => {
    await clearRecoveryAuthorization();
    return NextResponse.redirect(new URL("/reset-password?error=invalid-recovery", request.url));
  };
  let recoveryTokenVerified = false;
  let recoveryExchange = false;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error) {
      if (recoveryIntent) return recoveryFailure();
      console.error("Email confirmation code exchange failed:", {
        code: error.code || "AUTH_ERROR",
      });
      return failureRedirect(
        request,
        looksExpired(error.message) ? "expired-confirmation" : "session-exchange",
      );
    }
    recoveryExchange = Boolean(data && "redirectType" in data && data.redirectType === "recovery");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      if (recoveryIntent) return recoveryFailure();
      console.error("Email confirmation token verification failed:", {
        code: error.code || "AUTH_ERROR",
      });
      return failureRedirect(
        request,
        looksExpired(error.message) ? "expired-confirmation" : "invalid-confirmation",
      );
    }
    recoveryTokenVerified = type === "recovery";
  } else {
    if (recoveryIntent) return recoveryFailure();
    return failureRedirect(request, "invalid-confirmation");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (recoveryIntent || recoveryExchange) return recoveryFailure();
    console.error(
      "Email confirmation session validation failed:",
      { code: userError?.code || "NO_AUTHENTICATED_USER" },
    );
    return failureRedirect(request, "session-exchange");
  }

  if (recoveryIntent || recoveryExchange || recoveryTokenVerified) {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    // PKCE redirectType is browser-stored, not authoritative. Check signed AMR.
    // A successful server-side verifyOtp(type=recovery) is also authoritative.
    if (error || !claims || claims.sub !== user.id ||
      (!recoveryTokenVerified && !hasRecentRecoveryMethod(claims))) return recoveryFailure();
    try {
      if (!(await issueRecoveryAuthorization(claims))) return recoveryFailure();
    } catch {
      return recoveryFailure();
    }
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) {
    await supabase.auth.signOut();
    return failureRedirect(request, "missing-profile");
  }

  const synchronized = await synchronizeVerifiedProfileEmail(profile, user);
  const isEmailChange = request.nextUrl.searchParams.get("intent") === "email-change";
  const destination = new URL(
    isEmailChange && synchronized.profile.role === "CUSTOMER"
      ? "/dashboard/profile"
      : routeForRole(synchronized.profile.role),
    request.url,
  );
  if (isEmailChange && synchronized.changed) {
    destination.searchParams.set("emailUpdated", "1");
  } else if (isEmailChange) {
    destination.searchParams.set("emailChangePending", "1");
  } else if (synchronized.profile.role === "CUSTOMER") {
    destination.searchParams.set("confirmed", "1");
  }
  return NextResponse.redirect(destination);
}
