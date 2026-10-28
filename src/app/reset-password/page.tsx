import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { authMode } from "@/lib/server/config";

// Accounts or local mode is read when the page is requested, never fixed at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

type Props = { searchParams: Promise<{ token?: string }> };

// Opening the link only shows the form (mail scanners open links before people do); saving uses the token.
export default async function ResetPasswordPage({ searchParams }: Props) {
  if (authMode() !== "accounts") notFound();
  const { token } = await searchParams;
  if (!token) notFound();
  return (
    <AuthShell>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
