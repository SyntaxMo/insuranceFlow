import "server-only";

export function authCallbackUrl(
  parameters?: Record<string, string>,
): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredSiteUrl && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for production auth redirects.");
  }
  const siteUrl = configuredSiteUrl || "http://localhost:3000";
  const callback = new URL("/auth/callback", siteUrl);

  for (const [key, value] of Object.entries(parameters ?? {})) {
    callback.searchParams.set(key, value);
  }

  return callback.toString();
}
