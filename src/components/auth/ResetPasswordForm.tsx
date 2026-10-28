"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, CircleAlert, CircleCheck, LockKeyhole } from "lucide-react"

import { setNewPassword } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { authPrimary } from "./AuthShell"
import { AuthInput } from "./LoginPanel"

const DONE = {
  reset: { ok: true, title: "Password changed", text: "You've been logged out everywhere. Log in with your new password." },
  expired: { ok: false, title: "This link has expired", text: "Reset links work for 1 hour. Use “Forgot password?” on the log-in page to get a new one." },
  invalid: {
    ok: false,
    title: "This link doesn't work",
    text: "It may have been used already, or a newer link was sent. Use “Forgot password?” on the log-in page to get a new one.",
  },
} as const

/** The /reset-password page: choose a new password with the token from the email. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [pw, setPw] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<keyof typeof DONE | null>(null)

  if (done) {
    const d = DONE[done]
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-oak">
          {d.ok ? <CircleCheck aria-hidden="true" className="size-7 text-good" /> : <CircleAlert aria-hidden="true" className="size-7 text-destructive" />}
        </span>
        <h1 className="m-0 font-serif text-[32px] leading-tight font-medium">{d.title}</h1>
        <p className="m-0 text-[15px] leading-relaxed text-espresso/75">{d.text}</p>
        <Link href="/login" className={authPrimary}>
          Log in
        </Link>
      </section>
    )
  }

  const submit = async () => {
    if (pw !== confirm) return setError("The passwords don't match.")
    setError(null)
    setBusy(true)
    const res = await setNewPassword(token, pw)
    setBusy(false)
    if (res.ok) return setDone("reset")
    if (res.result) return setDone(res.result)
    setError(res.message ?? null)
  }

  return (
    <section aria-labelledby="reset-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="reset-title" className="m-0 font-serif text-[36px] leading-tight font-medium tracking-[-0.015em]">
          Choose a new password
        </h1>
        <p className="m-0 text-[15px] text-espresso/70">Choosing a new password logs you out on every device.</p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!busy && pw.length >= 8 && confirm) void submit()
        }}
      >
        <AuthInput
          label="New password"
          icon={<LockKeyhole className="size-4" />}
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={pw}
          onChange={setPw}
        />
        <AuthInput label="Confirm new password" icon={<LockKeyhole className="size-4" />} type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || pw.length < 8 || !confirm} className={cn(authPrimary, "w-full")}>
          {busy ? "Saving…" : "Save new password"}
          {!busy && <ArrowRight aria-hidden="true" className="size-4" />}
        </button>
      </form>
    </section>
  )
}
