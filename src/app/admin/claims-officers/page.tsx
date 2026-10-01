import type { Metadata } from "next";
import { ManagementPage, ManagementPagination } from "@/components/admin/ManagementPage";
import { StaffManagementControl } from "@/components/admin/ManagementDialog";
import { Alert, Card } from "@/components/ui/Forms";
import { requireAdmin } from "@/lib/auth/admin";
import { adminPageNumber, listClaimsOfficers } from "@/lib/admin/accounts";
import { formatDate } from "@/lib/format";
export const metadata: Metadata = { title: "Claims Officers | InsureFlow" };
export default async function ClaimsOfficersPage({ searchParams }: { searchParams?: Promise<{ page?: string }> } = {}) {
  await requireAdmin();
  const page = adminPageNumber((await searchParams)?.page);
  const result = await listClaimsOfficers(page);
  return <ManagementPage title="Claims Officers" description="Manage organization-owned staff names and work email addresses. Roles and passwords are not editable here.">
    {result.error ? <Alert tone="error">{result.error}</Alert> : <Card><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Claims Officer accounts</caption><thead><tr>{["Full name", "Work email", "Role", "Member since", "Action"].map(label => <th key={label} scope="col" className="border-b border-slate-200 px-3 py-3 font-semibold text-[var(--brand-navy)]">{label}</th>)}</tr></thead><tbody>{result.officers.map(officer => <tr key={officer.id}><td className="border-b border-slate-100 px-3 py-4 font-medium text-[var(--brand-navy)]">{officer.fullName}</td><td className="border-b border-slate-100 px-3 py-4 break-words">{officer.email}</td><td className="border-b border-slate-100 px-3 py-4">Claims Officer</td><td className="border-b border-slate-100 px-3 py-4 whitespace-nowrap">{formatDate(officer.createdAt)}</td><td className="border-b border-slate-100 px-3 py-4"><StaffManagementControl officer={officer} /></td></tr>)}</tbody></table></div>{!result.officers.length ? <p role="status" className="py-5 text-sm text-slate-600">No Claims Officers on this page.</p> : null}<ManagementPagination page={page} count={result.count} path="/admin/claims-officers" /></Card>}
  </ManagementPage>;
}
