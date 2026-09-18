import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET() {
  const profile = await getAuthenticatedProfile();

  if (!profile?.auth_user_id) {
    return NextResponse.json(
      { authenticated: false as const },
      { headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      authenticated: true as const,
      userId: profile.auth_user_id,
      role: profile.role,
    },
    { headers: NO_STORE_HEADERS },
  );
}
