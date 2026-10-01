import type { UserRole } from "@/types/database";
/** A named, fixed destination, never a browser-provided return URL. */
export function signInDestination(role: UserRole, next: unknown) {
  if (role === "CUSTOMER" && next === "settings") return "/dashboard/settings?section=privacy";
  return role === "CUSTOMER" ? "/dashboard" : "/admin";
}
