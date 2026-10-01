import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

const COOKIE = "insureflow_password_recovery";
const TTL = 900;
type Claims = { sub?: unknown; session_id?: unknown; amr?: unknown; [key: string]: unknown };

function signature(payload: string) {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret) throw new Error("Recovery authorization is unavailable.");
  return createHmac("sha256", secret).update(`password-recovery:${payload}`).digest("base64url");
}

/** Only call with claims verified by Supabase, never a decoded/unverified JWT. */
export function hasRecentRecoveryMethod(claims: Claims) {
  const now = Math.floor(Date.now() / 1000);
  return Array.isArray(claims.amr) && claims.amr.some((entry) =>
    entry?.method === "recovery" && typeof entry.timestamp === "number" &&
    entry.timestamp <= now + 30 && entry.timestamp > now - TTL,
  );
}

/** Callback-only authorization; this is not a custom password reset token. */
export async function issueRecoveryAuthorization(claims: Claims) {
  if (typeof claims.sub !== "string" || typeof claims.session_id !== "string") return false;
  const payload = Buffer.from(JSON.stringify({
    user: claims.sub, session: claims.session_id, expires: Math.floor(Date.now() / 1000) + TTL,
  })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${signature(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL,
  });
  return true;
}

export async function clearRecoveryAuthorization() {
  (await cookies()).delete(COOKIE);
}

export async function getRecoveryClient() {
  try {
    const value = (await cookies()).get(COOKIE)?.value;
    if (!value) return null;
    const [payload, supplied, extra] = value.split(".");
    if (!payload || !supplied || extra) return null;
    const actual = Buffer.from(signature(payload));
    const expected = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const grant = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof grant.expires !== "number" || grant.expires <= Date.now() / 1000) return null;
    const client = await createServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.id !== grant.user) return null;
    const { data, error: claimsError } = await client.auth.getClaims();
    if (claimsError || data?.claims.sub !== user.id || data.claims.session_id !== grant.session) return null;
    return client;
  } catch {
    return null;
  }
}
