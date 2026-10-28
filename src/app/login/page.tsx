import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { safeNext } from "@/lib/next-path";
import { auth } from "@/lib/server/auth";
import { authMode, googleEnabled } from "@/lib/server/config";

// Accounts or local mode is read when the page is requested, never fixed at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

type Props = { searchParams: Promise<{ mode?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { mode, next } = await searchParams;
  const to = safeNext(next);
  // Without accounts there is nothing to log in to: the calculator works in this browser.
  if (authMode() !== "accounts") redirect("/app");
  if ((await auth())?.user?.id) redirect(to);
  return (
    <AuthShell>
      <LoginPanel initialMode={mode === "join" ? "join" : "login"} google={googleEnabled()} next={to} />
    </AuthShell>
  );
}
