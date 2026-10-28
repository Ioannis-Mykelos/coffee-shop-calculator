import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { AuthMessage, authPrimary, authSecondary } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Sign-in problem", robots: { index: false } };

// Auth.js sends sign-in failures here (e.g. Google sign-in cancelled, or an address Google hasn't verified).
const MESSAGES: Record<string, string> = {
  AccessDenied: "Sign-in wasn't allowed. If you used Google, make sure your Google account's email address is verified.",
  Configuration: "Sign-in is not set up correctly on our side. Please try again later.",
  Verification: "That sign-in link has expired or has been used already.",
};

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthMessage
      icon={<CircleAlert className="size-7 text-destructive" />}
      title="Sign-in didn't work"
      actions={
        <>
          <Link href="/login" className={authPrimary}>
            Try again
          </Link>
          <Link href="/" className={authSecondary}>
            Crema home
          </Link>
        </>
      }
    >
      {MESSAGES[error ?? ""] ?? "Something went wrong while signing you in. Please try again."}
    </AuthMessage>
  );
}
