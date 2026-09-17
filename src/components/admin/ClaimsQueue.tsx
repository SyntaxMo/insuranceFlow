"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, TextInput, buttonClassName } from "@/components/ui/Forms";
import { formatDate, formatDateTime, officerClaimStatusLabel, statusTone } from "@/lib/format";
import type { ClaimListItem } from "@/types/database";

const FILTERS = [
  ["ALL", "All"],
  ["SUBMITTED", "New"],
  ["UNDER_REVIEW", "Under Review"],
  ["MORE_INFO_REQUIRED", "Waiting on Customer"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
  ["CLOSED", "Closed"],
] as const;

function ClaimActivity({ claim }: { claim: ClaimListItem }) {
  const hasActivity = claim.hasAiAnalysis || claim.customerResponded;

  if (!hasActivity) {
    return (
      <span className="text-sm text-slate-400" aria-label="No secondary activity">
        —
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Claim activity">
      {claim.hasAiAnalysis ? (
        <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-inset ring-teal-100">
          AI review ready
        </span>
      ) : null}
      {claim.customerResponded ? (
        <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-100">
          Customer responded
        </span>
      ) : null}
    </div>
  );
}

export function ClaimsQueue({ claims }: { claims: ClaimListItem[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("ALL");
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return claims.filter((claim) => {
      if (filter !== "ALL" && claim.status.toUpperCase() !== filter) return false;
      if (!term) return true;
      return [claim.claimNumber, claim.customerName, claim.policyNumber, claim.vehicleLabel]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [claims, filter, search]);

  return (
    <section aria-labelledby="claim-queue-heading" className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="claim-queue-heading" className="text-xl font-semibold text-[var(--brand-navy)]">Claim queue</h2>
          <p className="mt-1 text-sm text-slate-600">Newest submissions appear first.</p>
        </div>
        <div className="w-full lg:max-w-xs">
          <label htmlFor="claim-search" className="sr-only">Search claims</label>
          <TextInput
            id="claim-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search claim, customer, or policy"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter claims by status">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${filter === value ? "bg-[var(--brand-navy)] text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card><p className="text-sm text-slate-600">No claims match this view.</p></Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <table className="min-w-[980px] divide-y divide-slate-200 text-left text-sm xl:min-w-full">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Claim</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Policy</th>
                  <th className="px-4 py-3 font-semibold">Accident</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Activity</th>
                  <th className="px-4 py-3 font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((claim) => (
                  <tr key={claim.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-4"><p className="font-semibold text-[var(--brand-navy)]">{claim.claimNumber}</p><p className="mt-1 text-xs text-slate-500">Submitted {formatDateTime(claim.createdAt)}</p></td>
                    <td className="px-4 py-4">{claim.customerName}</td>
                    <td className="px-4 py-4">{claim.vehicleLabel}</td>
                    <td className="px-4 py-4">{claim.policyNumber}</td>
                    <td className="px-4 py-4">{formatDate(claim.accidentDate)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}>{officerClaimStatusLabel(claim.status)}</span>
                    </td>
                    <td className="px-4 py-4"><ClaimActivity claim={claim} /></td>
                    <td className="px-4 py-4"><Link href={`/admin/claims/${claim.id}`} className={buttonClassName("secondary", "min-h-9 px-3 py-2")}>{claim.status.toUpperCase() === "SUBMITTED" ? "Review" : "View"}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {visible.map((claim) => (
              <Card key={claim.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold text-[var(--brand-navy)]">{claim.claimNumber}</p><p className="mt-1 text-sm text-slate-600">{claim.customerName}</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(claim.status)}`}>{officerClaimStatusLabel(claim.status)}</span>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Vehicle</dt><dd>{claim.vehicleLabel}</dd></div><div><dt className="text-xs text-slate-500">Policy</dt><dd>{claim.policyNumber}</dd></div></dl>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Activity</p>
                  <ClaimActivity claim={claim} />
                </div>
                <Link href={`/admin/claims/${claim.id}`} className={buttonClassName("secondary", "w-full sm:w-auto")}>View claim</Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
