import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountPage } from "@/components/account/AccountPage";
import { auth } from "@/lib/server/auth";
import { authMode } from "@/lib/server/config";

// Accounts or local mode is read when the page is requested, never fixed at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Account & security", robots: { index: false } };

export default async function Account() {
  // Local mode has no accounts to manage.
  if (authMode() !== "accounts") redirect("/app");
  if (!(await auth())?.user?.id) redirect("/login?next=/app/account");
  return <AccountPage />;
}
