import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleAlert, CircleCheck, MailCheck } from "lucide-react";
import { AuthMessage, authPrimary } from "@/components/auth/AuthShell";
import { verifyEmail, type VerifyResult } from "@/lib/server/accounts";
import { authMode, emailLoginEnabled } from "@/lib/server/config";
import { mongoUserStore } from "@/lib/server/db";

// Accounts or local mode is read when the page is requested, never fixed at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

type Props = { searchParams: Promise<{ token?: string; result?: string }> };

// Mail scanners open links before people do, so opening the link only shows a button; the button confirms.
async function confirm(form: FormData) {
  "use server";
  const result = await verifyEmail({ store: mongoUserStore }, String(form.get("token") ?? ""));
  redirect(`/verify-email?result=${result}`);
}

const RESULTS: Record<VerifyResult, { ok: boolean; title: string; text: string }> = {
  verified: { ok: true, title: "Email confirmed", text: "Your account is ready. Log in to set up your first month." },
  expired: {
    ok: false,
    title: "This link has expired",
    text: "Confirmation links work for 24 hours. Log in with your email and password to get a new one.",
  },
  invalid: {
    ok: false,
    title: "This link doesn't work",
    text: "It may have been used already, or a newer link was sent. Try logging in; if your email still needs confirming, you can get a new link there.",
  },
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  if (authMode() !== "accounts" || !emailLoginEnabled()) notFound();
  const { token, result } = await searchParams;

  if (result && result in RESULTS) {
    const r = RESULTS[result as VerifyResult];
    return (
      <AuthMessage
        icon={r.ok ? <CircleCheck className="size-7 text-good" /> : <CircleAlert className="size-7 text-destructive" />}
        title={r.title}
        actions={
          <Link href="/login" className={authPrimary}>
            Log in
          </Link>
        }
      >
        {r.text}
      </AuthMessage>
    );
  }

  if (!token) notFound();
  return (
    <AuthMessage
      icon={<MailCheck className="size-7" />}
      title="Confirm your email"
      actions={
        <form action={confirm}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={authPrimary}>
            Confirm my email
          </button>
        </form>
      }
    >
      One click and your Crema account is ready.
    </AuthMessage>
  );
}
