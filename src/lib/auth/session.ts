import "server-only";

import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { User as ApplicationUser, UserRole } from "@/types/database";

export type AuthProfile = Pick<
  ApplicationUser,
  | "id"
  | "full_name"
  | "email"
  | "phone"
  | "role"
  | "auth_user_id"
  | "created_at"
>;

const PROFILE_COLUMNS =
  "id, full_name, email, phone, role, auth_user_id, created_at" as const;

export function isStaffRole(role: UserRole): boolean {
  return role === "CLAIMS_OFFICER" || role === "ADMIN";
}

export function routeForRole(role: UserRole): "/dashboard" | "/admin" {
  return role === "CUSTOMER" ? "/dashboard" : "/admin";
}

export async function getProfileByAuthUserId(
  authUserId: string,
): Promise<AuthProfile | null> {
  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient
    .from("users")
    .select(PROFILE_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("Authenticated profile lookup failed:", error.message);
    return null;
  }

  if (!data) return null;
  if (!["CUSTOMER", "CLAIMS_OFFICER", "ADMIN"].includes(data.role)) {
    console.error("Authenticated profile has an unsupported role.");
    return null;
  }

  return data as AuthProfile;
}

export async function synchronizeVerifiedProfileEmail(
  profile: AuthProfile,
  authUser: Pick<SupabaseAuthUser, "id" | "email">,
): Promise<{ profile: AuthProfile; changed: boolean }> {
  const verifiedEmail = authUser.email?.trim().toLowerCase();
  const profileEmail = profile.email?.trim().toLowerCase();

  if (
    !verifiedEmail ||
    profile.role !== "CUSTOMER" ||
    authUser.id !== profile.auth_user_id ||
    verifiedEmail === profileEmail
  ) {
    return { profile, changed: false };
  }

  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient
    .from("users")
    .update({ email: verifiedEmail })
    .eq("id", profile.id)
    .eq("auth_user_id", authUser.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error || !data) {
    console.error(
      "Verified profile email synchronization failed:",
      error?.code || "PROFILE_UPDATE_FAILED",
    );
    return { profile, changed: false };
  }

  return { profile: data as AuthProfile, changed: true };
}

export async function getAuthenticatedProfile(): Promise<AuthProfile | null> {
  const authClient = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) return null;
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) return null;
  const synchronized = await synchronizeVerifiedProfileEmail(profile, user);
  return synchronized.profile;
}

export async function requireCustomer(): Promise<AuthProfile> {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/login");
  if (isStaffRole(profile.role)) redirect("/admin");
  return profile;
}

export async function requireStaff(): Promise<AuthProfile> {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/login");
  if (!isStaffRole(profile.role)) redirect("/dashboard");
  return profile;
}

export async function getCustomerForApi(): Promise<AuthProfile | null> {
  const profile = await getAuthenticatedProfile();
  return profile?.role === "CUSTOMER" ? profile : null;
}

export async function getStaffForApi(): Promise<AuthProfile | null> {
  const profile = await getAuthenticatedProfile();
  return profile && isStaffRole(profile.role) ? profile : null;
}
