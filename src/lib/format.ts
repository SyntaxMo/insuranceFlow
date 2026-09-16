export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 3,
    maximumFractionDigits: 3,
  }).format(amount);
  return `BHD ${formatted}`;
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
  if (normalized === "ACTIVE")
    return "bg-emerald-50 text-emerald-800 ring-emerald-300";
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

const COVERAGE_LABELS: Record<string, string> = {
  COMPREHENSIVE: "Comprehensive",
  THIRD_PARTY: "Third Party",
};

export function formatCoverageType(value: string): string {
  const normalized = value.trim().replace(/[\s-]+/g, "_").toUpperCase();
  return (
    COVERAGE_LABELS[normalized] ||
    normalized
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatVehiclePart(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word || /[a-z].*[A-Z]|[A-Z].*[a-z]/.test(word)) return word;
      if (/^[A-Z]{1,3}$/.test(word)) return word;
      if (!/^[A-Za-z]+$/.test(word)) return word;
      return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

/** Display-only formatting that preserves deliberately mixed-case vehicle names. */
export function formatVehicleName(make: string, model: string): string {
  return [formatVehiclePart(make), formatVehiclePart(model)].filter(Boolean).join(" ");
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  MORE_INFO_REQUIRED: "More information required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CLOSED: "Closed",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const OFFICER_CLAIM_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "Under Review",
  MORE_INFO_REQUIRED: "Waiting on Customer",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

export function officerClaimStatusLabel(status: string): string {
  return OFFICER_CLAIM_STATUS_LABELS[status.trim().toUpperCase()] || statusLabel(status);
}

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
