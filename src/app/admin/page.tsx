import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Claims workspace | InsureFlow" };

export default function AdminPage() {
  redirect("/admin/claims");
}
