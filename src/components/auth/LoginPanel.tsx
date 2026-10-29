"use client"

import Image from "next/image"
import Link from "next/link"
import { useId, useState } from "react"
import { ArrowRight, CircleAlert, KeyRound, LoaderCircle, LockKeyhole, Mail, MailCheck } from "lucide-react"

import { continueWithGoogle, forgotPassword, joinWithPassword, logInWithPassword, resendLink } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { authPrimary } from "./AuthShell"

export type LoginMode = "login" | "join"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LOGIN_ERROR = {
  invalid: "That email and password don't match an account.",
  unverified: "Confirm your email first: open the link we sent you.",
  rate_limited: "Too many log-in attempts. Try again in 15 minutes.",
  totp_required: "Enter the code from your authenticator app.",
  totp_invalid: "That code didn't work. Use the newest one from your app (check your phone's time is set automatically), or a recovery code.",
  failed: "We couldn't log you in. Please try again.",
} as const

/**
 * Log in / Sign up. Email + password, with the authenticator app's code as a second step when two-step login is on;
 * Sign up emails a confirmation link; "Forgot password?" emails a reset link to the address typed in. Google leaves
 * for Google's sign-in page and comes back to `next`. Without `email` (the site can't send emails yet) it's Google only.
 */
export function LoginPanel({ initialMode, google, email: emailLogin, next }: { initialMode: LoginMode; google: boolean; email: boolean; next: string }) {
  const [tab, setTab] = useState<LoginMode>(initialMode)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [remember, setRemember] = useState(true)
  const [agree, setAgree] = useState(false)
  const [status, setStatus] = useState<"idle" | "busy" | "google" | "sent" | "reset-sent">("idle")
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Two-step login: after the right password, the account asked for a code (from the app, or a recovery code).
  const [codeStep, setCodeStep] = useState(false)
  const [code, setCode] = useState("")
  const ids = useId()

  const isLogin = tab === "login"
  const trimmed = email.trim()
  const canSubmit =
    status === "idle" &&
    EMAIL_RE.test(trimmed) &&
    pw.length >= (isLogin ? 1 : 8) &&
    (isLogin || (agree && !!firstName.trim() && !!lastName.trim())) &&
    (!codeStep || code.trim().length >= 6)

  const switchTab = (t: LoginMode) => {
    setTab(t)
    setStatus("idle")
    setError(null)
    setUnverified(false)
    setNotice(null)
    setCodeStep(false)
    setCode("")
    window.history.replaceState(null, "", t === "join" ? `/login?mode=join${next !== "/app" ? `&next=${encodeURIComponent(next)}` : ""}` : `/login${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`)
  }

  const submit = async () => {
    setError(null)
    setUnverified(false)
    setNotice(null)
    setStatus("busy")
    if (isLogin) {
      const res = await logInWithPassword(trimmed, pw, remember, codeStep ? code.trim() : undefined)
      if (res.ok) return window.location.assign(next)
      setStatus("idle")
      if (res.error === "totp_required") return setCodeStep(true)
      if (res.error === "totp_invalid") setCode("")
      setError(LOGIN_ERROR[res.error])
      setUnverified(res.error === "unverified")
      return
    }
    const res = await joinWithPassword({ firstName: firstName.trim(), lastName: lastName.trim(), email: trimmed, password: pw, consent: agree })
    if (res.ok) {
      setPw("")
      return setStatus("sent")
    }
    setStatus("idle")
    setError(res.message ?? Object.values(res.errors ?? {})[0] ?? null)
  }

  const forgot = async () => {
    setUnverified(false)
    setNotice(null)
    if (!EMAIL_RE.test(trimmed)) return setError("Type your email above first, and we'll send you a link to reset your password.")
    setError(null)
    const res = await forgotPassword(trimmed)
    if (!res.ok) return setError(res.message)
    setPw("")
    setStatus("reset-sent")
  }

  const resend = async () => {
    await resendLink(trimmed)
    setNotice(`If ${trimmed} still needs confirming, a new link is on its way. It works for 24 hours.`)
  }

  const googleButton = (
    <button
      type="button"
      disabled={status !== "idle"}
      onClick={() => {
        setStatus("google")
        void continueWithGoogle(next)
      }}
      className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-espresso/20 bg-white text-[15px] font-semibold text-espresso outline-none hover:bg-oak/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
    >
      {status === "google" ? (
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
      ) : (
        <Image src="/brand/google-g.svg" alt="" width={20} height={20} unoptimized />
      )}
      {status === "google" ? "Connecting to Google…" : isLogin ? "Continue with Google" : "Sign up with Google"}
    </button>
  )

  if (!emailLogin) {
    return (
      <section aria-labelledby={`${ids}-title`} className="flex flex-col gap-6">
        <Heading id={`${ids}-title`} isLogin={isLogin} />
        {googleButton}
        <p className="m-0 text-center text-[13px] leading-relaxed text-espresso/65">
          By continuing, you accept the{" "}
          <Link href="/terms" target="_blank">
            Terms
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" target="_blank">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    )
  }

  if (status === "sent" || status === "reset-sent") {
    return (
      <section aria-labelledby={`${ids}-title`} className="flex flex-col items-center gap-4 text-center" aria-live="polite">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-oak">
          <MailCheck aria-hidden="true" className="size-7" />
        </span>
        <h1 id={`${ids}-title`} className="m-0 font-serif text-[32px] leading-tight font-medium">
          Check your inbox
        </h1>
        <p className="m-0 text-[15px] leading-relaxed text-espresso/75">
          {status === "sent" ? (
            <>
              We sent a confirmation link to <strong className="text-espresso">{trimmed}</strong>. Open it to finish creating your account; it works
              for 24 hours.
            </>
          ) : (
            <>
              If <strong className="text-espresso">{trimmed}</strong> has a Crema account, we sent it a link to choose a new password. It works for 1
              hour.
            </>
          )}
        </p>
        {notice && (
          <p role="status" className="m-0 text-sm text-espresso/70">
            {notice}
          </p>
        )}
        <div className="flex gap-5 text-sm font-semibold">
          {status === "sent" && (
            <button type="button" onClick={resend} className="cursor-pointer text-brand hover:text-brand-strong">
              Send a new link
            </button>
          )}
          <button type="button" onClick={() => switchTab("login")} className="cursor-pointer text-brand hover:text-brand-strong">
            Back to log in
          </button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="flex flex-col gap-6">
      <Heading id={`${ids}-title`} isLogin={isLogin} />

      <div role="tablist" aria-label="Log in or sign up" className="grid grid-cols-2 gap-1 rounded-full bg-oak/60 p-1">
        {(["login", "join"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${ids}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${ids}-panel`}
            onClick={() => switchTab(t)}
            className={cn(
              "min-h-10 cursor-pointer rounded-full text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              tab === t ? "bg-white text-espresso shadow-[0_1px_3px_rgba(42,29,22,0.15)]" : "text-espresso/65 hover:text-espresso",
            )}
          >
            {t === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-tab-${tab}`} className="flex flex-col gap-5">
        {google && !codeStep && (
          <>
            {googleButton}
            <div className="flex items-center gap-3 text-[13px] text-espresso/55">
              <span className="h-px flex-1 bg-espresso/15" />
              or with email
              <span className="h-px flex-1 bg-espresso/15" />
            </div>
          </>
        )}

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) void submit()
          }}
        >
          {isLogin && codeStep ? (
            <div className="flex flex-col gap-4">
              <p className="m-0 flex gap-2.5 rounded-2xl bg-oak/50 p-3.5 text-sm leading-relaxed">
                <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
                Open your authenticator app (Google or Microsoft Authenticator, 1Password, Authy…) and enter the 6-digit code for Crema.
              </p>
              <AuthInput
                label="Code"
                icon={<LockKeyhole className="size-4" />}
                autoComplete="one-time-code"
                autoFocus
                placeholder="123 456"
                maxLength={11}
                value={code}
                onChange={setCode}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-espresso/65">
                <span>Lost your phone? Enter a recovery code instead.</span>
                <button
                  type="button"
                  className="cursor-pointer font-semibold text-brand hover:text-brand-strong"
                  onClick={() => {
                    setCodeStep(false)
                    setCode("")
                    setError(null)
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              {!isLogin && (
                <div className="grid grid-cols-2 gap-3">
                  <AuthInput label="First name" autoComplete="given-name" maxLength={50} value={firstName} onChange={setFirstName} />
                  <AuthInput label="Last name" autoComplete="family-name" maxLength={50} value={lastName} onChange={setLastName} />
                </div>
              )}
              <AuthInput label="Email" icon={<Mail className="size-4" />} type="email" autoComplete="email" placeholder="you@yourcafe.com" value={email} onChange={setEmail} />
              <AuthInput
                label="Password"
                icon={<LockKeyhole className="size-4" />}
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder={isLogin ? "Your password" : "At least 8 characters"}
                value={pw}
                onChange={setPw}
              />
              {isLogin ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-espresso" />
                    Keep me logged in
                  </label>
                  <button type="button" onClick={forgot} className="cursor-pointer font-semibold text-brand hover:text-brand-strong">
                    Forgot password?
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-4 shrink-0 accent-espresso" />
                  <span>
                    I accept the{" "}
                    <Link href="/terms" target="_blank">
                      Terms
                    </Link>{" "}
                    and the{" "}
                    <Link href="/privacy" target="_blank">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              )}
            </>
          )}

          {error && (
            <div role="alert" className="flex gap-2.5 rounded-2xl bg-[#FBEDEF] p-3.5 text-sm leading-relaxed text-destructive">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                {error}
                {unverified && (
                  <>
                    {" "}
                    <button type="button" onClick={resend} className="cursor-pointer font-semibold underline">
                      Send a new link
                    </button>
                  </>
                )}
              </span>
            </div>
          )}
          {notice && (
            <p role="status" className="m-0 text-sm text-espresso/70">
              {notice}
            </p>
          )}

          <button type="submit" disabled={!canSubmit} className={cn(authPrimary, "w-full")}>
            {status === "busy" ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                {isLogin ? "Logging in…" : "Creating your account…"}
              </>
            ) : (
              <>
                {isLogin ? (codeStep ? "Verify and log in" : "Log in") : "Create account"}
                <ArrowRight aria-hidden="true" className="size-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </section>
  )
}

/** "Welcome back" for logging in, "Start with Crema" for signing up. */
function Heading({ id, isLogin }: { id: string; isLogin: boolean }) {
  return (
        <div className="flex flex-col gap-2">
          <h1 id={id} className="m-0 font-serif text-[36px] leading-tight font-medium tracking-[-0.015em]">
            {isLogin ? "Welcome back" : "Start with Crema"}
          </h1>
          <p className="m-0 text-[15px] text-espresso/70">
            {isLogin ? "Log in to your café's numbers." : "Free during beta. Your first month takes about ten minutes."}
          </p>
        </div>
  )
}

/** A labelled text field with an optional icon inside it. */
function AuthInput({
  label,
  icon,
  value,
  onChange,
  ...props
}: { label: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-espresso/75">
      {label}
      <span className="relative flex items-center">
        {icon && <span aria-hidden="true" className="pointer-events-none absolute left-3.5 text-espresso/45">{icon}</span>}
        <input
          {...props}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-12 w-full min-w-0 rounded-xl border border-input bg-white px-3.5 text-[15px] font-medium text-espresso outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            icon && "pl-10",
          )}
        />
      </span>
    </label>
  )
}

export { AuthInput }
