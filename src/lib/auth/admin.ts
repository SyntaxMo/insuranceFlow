import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "./session";
export async function getAdminForApi() {
  const profile = await getAuthenticatedProfile();
  return profile?.role === "ADMIN" ? profile : null;
}
export async function requireAdmin() {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "ADMIN") redirect(profile.role === "CUSTOMER" ? "/dashboard" : "/admin/claims");
  return profile;
}
