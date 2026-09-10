import "server-only";

import { redirect } from "next/navigation";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { User, UserRole } from "@/types/database";

export type AuthProfile = Pick<
  User,
  "id" | "full_name" | "email" | "phone" | "role" | "auth_user_id"
>;

const PROFILE_COLUMNS =
  "id, full_name, email, phone, role, auth_user_id" as const;

export function isStaffRole(role: UserRole): boolean {
  return role === "CLAIMS_OFFICER" || role === "ADMIN";
}

export function routeForRole(role: UserRole): "/dashboard" | "/admin" {
  return role === "CUSTOMER" ? "/dashboard" : "/admin";
}

export async function getAuthenticatedProfile(): Promise<AuthProfile | null> {
  const authClient = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) return null;

  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient
    .from("users")
    .select(PROFILE_COLUMNS)
    .eq("auth_user_id", user.id)
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
