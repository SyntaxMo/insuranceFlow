import { ProtectedSessionSync } from "@/components/auth/ProtectedSessionSync";
import { requireCustomer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ClaimLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireCustomer();
  return (
    <ProtectedSessionSync
      initialUserId={profile.auth_user_id ?? ""}
      initialRole={profile.role}
      area="customer"
    >
      {children}
    </ProtectedSessionSync>
  );
}
