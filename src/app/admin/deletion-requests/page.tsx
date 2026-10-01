import type { Metadata } from "next";
import { ManagementPage, ManagementPagination } from "@/components/admin/ManagementPage";
import { RequestManagementActions } from "@/components/admin/ManagementDialog";
import { Alert, Card } from "@/components/ui/Forms";
import { requireAdmin } from "@/lib/auth/admin";
import { adminPageNumber, listDeletionRequests } from "@/lib/admin/accounts";
import { formatDate } from "@/lib/format";
export const metadata: Metadata = { title: "Deletion requests | InsureFlow" };
const statusLabels = { PENDING: "Pending", PROCESSING: "Processing", COMPLETED: "Completed", REJECTED: "Rejected", CANCELLED: "Cancelled" };
export default async function DeletionRequestsPage({ searchParams }: { searchParams?: Promise<{ page?: string }> } = {}) {
  await requireAdmin();
  const page = adminPageNumber((await searchParams)?.page);
  const result = await listDeletionRequests(page);
  return <ManagementPage title="Deletion requests" description="Review privacy requests and manage their status. No account data is deleted by these actions.">
    {result.error ? <Alert tone="error">{result.error}</Alert> : <Card><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Customer data deletion requests</caption><thead><tr>{["Customer", "Submitted", "Status", "Reason / resolution", "Action"].map(label => <th key={label} scope="col" className="border-b border-slate-200 px-3 py-3 font-semibold text-[var(--brand-navy)]">{label}</th>)}</tr></thead><tbody>{result.requests.map(request => <tr key={request.id}>
      <td className="border-b border-slate-100 px-3 py-4"><p className="font-medium text-[var(--brand-navy)]">{request.customerName}</p><p className="mt-1 break-words text-slate-600">{request.customerEmail}</p></td>
      <td className="border-b border-slate-100 px-3 py-4 whitespace-nowrap">{formatDate(request.createdAt)}</td><td className="border-b border-slate-100 px-3 py-4">{statusLabels[request.status]}</td>
      <td className="max-w-sm border-b border-slate-100 px-3 py-4 break-words [overflow-wrap:anywhere]"><p>{request.reason || "No reason provided"}</p>{request.resolutionNote ? <p className="mt-2 text-slate-600">Resolution: {request.resolutionNote}</p> : null}{request.resolvedAt ? <p className="mt-1 text-slate-600">Resolved {formatDate(request.resolvedAt)}</p> : null}</td><td className="border-b border-slate-100 px-3 py-4"><RequestManagementActions request={request} /></td>
    </tr>)}</tbody></table></div>{!result.requests.length ? <p role="status" className="py-5 text-sm text-slate-600">No requests on this page.</p> : null}<ManagementPagination page={page} count={result.count} path="/admin/deletion-requests" /></Card>}
  </ManagementPage>;
}
