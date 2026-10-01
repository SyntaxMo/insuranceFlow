import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { getAdminOverview } from "@/lib/admin/accounts";
import { Card, buttonClassName } from "@/components/ui/Forms";

export const metadata: Metadata = { title: "Admin | InsureFlow" };

export default async function AdminPage() {
  const profile = await requireStaff();
  if (profile.role !== "ADMIN") redirect("/admin/claims");
  const overview = await getAdminOverview();
  return <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12"><header><h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">Admin</h1><p className="mt-2 text-slate-600">Manage privacy requests and organization-managed staff accounts.</p></header><div className="mt-8 grid gap-6 sm:grid-cols-2">{[{ label: "Pending deletion requests", value: overview.pending, href: "/admin/deletion-requests", action: "View deletion requests" }, { label: "Claims Officers", value: overview.officers, href: "/admin/claims-officers", action: "View Claims Officers" }].map(item => <Card key={item.href}><h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-navy)]">{item.label}</h2><p className="mt-3 text-3xl font-semibold text-[var(--brand-navy)]">{item.value ?? "Unavailable"}</p><Link href={item.href} className={buttonClassName("secondary", "mt-5 cursor-pointer")}>{item.action}</Link></Card>)}</div></div>;
}
