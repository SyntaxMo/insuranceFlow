import type { Metadata } from "next";
import { BackToDashboardLink } from "@/components/navigation/BackToDashboardLink";
import { ChangePasswordControl } from "@/components/profile/ChangePasswordControl";
import { Card } from "@/components/ui/Forms";
import { ProfileIcon } from "@/components/ui/ProfileIcon";
import { requireStaff } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { requestPasswordChangeCodeAction, updatePasswordAction } from "./actions";

export const metadata: Metadata = { title: "Staff profile | InsureFlow" };

export default async function StaffProfilePage() {
  const profile = await requireStaff();
  const authClient = await createServerClient();
  const { data: { user }, error } = await authClient.auth.getUser();
  const email = !error && user?.id === profile.auth_user_id ? user.email?.trim() : undefined;
  const rows = [
    { label: "Full name", value: profile.full_name?.trim() || "Not provided" },
    { label: "Work email", value: email || "Not provided" },
    { label: "Role", value: profile.role === "ADMIN" ? "Administrator" : "Claims Officer" },
    {
      label: "Password",
      value: <><span aria-hidden="true" className="tracking-[0.18em]">••••••••</span><span className="sr-only">Password is set</span></>,
      action: email ? <ChangePasswordControl currentEmail={email} requestCodeAction={requestPasswordChangeCodeAction} changePasswordAction={updatePasswordAction} /> : undefined,
    },
    { label: "Member since", value: profile.created_at ? formatDate(profile.created_at) : "Not available" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <BackToDashboardLink href="/admin/claims" label="Back to claims" />
      <header className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--brand-navy)] text-white shadow-sm ring-4 ring-teal-50">
          <ProfileIcon className="size-7" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal)]">Staff account</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">Your profile</h1>
        </div>
      </header>
      <section className="mt-8" aria-labelledby="staff-account-details-heading">
        <Card>
          <h2 id="staff-account-details-heading" className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">Account details</h2>
          <p className="mt-1 text-sm text-slate-500">Your staff account details are managed by your organization.</p>
          <dl className="mt-6">
            {rows.map(({ label, value, action }) => (
              <div key={label} className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 py-4 first:pt-0 last:border-0 last:pb-0">
                <div className="min-w-0 sm:flex sm:items-center sm:gap-4">
                  <dt className="shrink-0 text-sm text-slate-500">{label}</dt>
                  <dd className="mt-1 min-w-0 break-words text-sm font-medium text-[var(--brand-navy)] [overflow-wrap:anywhere] sm:mt-0">{value}</dd>
                </div>
                {action ? <span className="flex shrink-0 justify-end">{action}</span> : null}
              </div>
            ))}
          </dl>
        </Card>
      </section>
    </div>
  );
}
