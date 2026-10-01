import Link from "next/link";
import type { ReactNode } from "react";
import { BackToDashboardLink } from "@/components/navigation/BackToDashboardLink";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/accounts";
export function ManagementPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12"><BackToDashboardLink href="/admin" label="Back to admin" /><header className="mt-5"><h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-navy)] sm:text-4xl">{title}</h1><p className="mt-2 text-slate-600">{description}</p></header><div className="mt-8">{children}</div></div>;
}
export function ManagementPagination({ page, count, path }: { page: number; count: number; path: string }) {
  const linkClass = "cursor-pointer rounded text-sm font-semibold text-[var(--brand-teal-deep)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]";
  return <nav aria-label="List pagination" className="mt-5 flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-slate-600">Page {page} · {count} records</p><div className="flex gap-5">{page > 1 ? <Link href={`${path}?page=${page - 1}`} className={linkClass}>Previous page</Link> : null}{page * ADMIN_PAGE_SIZE < count ? <Link href={`${path}?page=${page + 1}`} className={linkClass}>Next page</Link> : null}</div></nav>;
}
