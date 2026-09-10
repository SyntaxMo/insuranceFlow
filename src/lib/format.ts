export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function statusTone(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "SUBMITTED") return "bg-sky-50 text-sky-800 ring-sky-200";
  if (normalized === "UNDER_REVIEW")
    return "bg-amber-50 text-amber-800 ring-amber-200";
  if (normalized === "MORE_INFO_REQUIRED")
    return "bg-orange-50 text-orange-800 ring-orange-200";
  if (normalized === "APPROVED")
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (normalized === "REJECTED") return "bg-rose-50 text-rose-800 ring-rose-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  MORE_INFO_REQUIRED: "Action required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CLOSED: "Closed",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export function statusLabel(status: string): string {
  const normalized = status.trim().toUpperCase();
  return (
    STATUS_LABELS[normalized] ||
    normalized
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}
