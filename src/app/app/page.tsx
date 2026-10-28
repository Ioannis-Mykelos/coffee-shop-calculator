import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExpensesApp } from "@/components/expenses/ExpensesApp";
import { auth } from "@/lib/server/auth";
import { authMode } from "@/lib/server/config";

// Accounts or local mode is read when the page is requested, never fixed at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Monthly expenses", robots: { index: false } };

export default async function CalculatorPage() {
  if (authMode() !== "accounts") return <ExpensesApp mode="local" />;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login?next=/app");
  const { firstName, lastName, email } = session.user;
  return <ExpensesApp mode="accounts" user={{ firstName, lastName, email }} />;
}
