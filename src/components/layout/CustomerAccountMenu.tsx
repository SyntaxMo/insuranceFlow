"use client";

import { AccountMenu } from "@/components/layout/AccountMenu";

export function CustomerAccountMenu({ customerName, customerEmail }: {
  customerName: string | null;
  customerEmail: string | null;
}) {
  return <AccountMenu accountName={customerName} accountEmail={customerEmail} profileHref="/dashboard/profile" fallbackName="Customer" />;
}
