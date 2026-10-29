"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, CircleCheck, Download, KeyRound, LockKeyhole, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react"

import { AuthInput } from "@/components/auth/LoginPanel"
import { Button } from "@/components/ui/button"
import {
  type AccountSettings,
  changeMyPassword,
  continueWithGoogle,
  deleteMyAccount,
  disableTwoStep,
  enableTwoStep,
  fetchAccountSettings,
  forgotPassword,
  logInWithPassword,
  logOut,
  sessionRemembered,
  startTwoStep,
} from "@/lib/auth-client"

const WRONG_PASSWORD = "That password isn't right."

type Notify = (text: string, tone?: "good" | "bad") => void

/**
 * Account & security: the profile, the password, two-step login and deleting the account. Each change asks for the
 * current password again (lib/server/accounts.ts). An account made with Google gets a link to set a password first,
 * when the site sends emails, and deletes itself after a fresh Google log in.
 */
export function AccountPage() {
  const [settings, setSettings] = useState<AccountSettings | null>(null)
  const [failed, setFailed] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [notice, setNotice] = useState<{ text: string; tone: "good" | "bad" } | null>(null)
  const notify: Notify = (text, tone = "good") => setNotice({ text, tone })

  useEffect(() => {
    let live = true
    void fetchAccountSettings().then((res) => {
      if (!live) return
      if (res) setSettings(res)
      else setFailed(true)
    })
    return () => {
      live = false
    }
  }, [])

  if (deleted) {
    return (
      <Shell>
        <section className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-7">
          <CircleCheck aria-hidden="true" className="size-8 text-good" />
          <h1 className="m-0 font-display text-2xl font-semibold">Your account is deleted</h1>
          <p className="m-0 text-muted-foreground">Your account and all its figures are gone, and you&apos;ve been logged out.{settings?.emailLogin && " We've emailed you to confirm."}</p>
          <Button asChild>
            <Link href="/">Back to Crema</Link>
          </Button>
        </section>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="flex flex-col gap-2">
        <Link href="/app" className="flex w-fit items-center gap-1.5 text-sm font-semibold no-underline">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to your figures
        </Link>
        <h1 className="m-0 font-display text-[30px] font-semibold tracking-[-0.01em]">Account &amp; security</h1>
      </header>
      {notice && (
        <p role="status" className={`m-0 rounded-xl px-4 py-3 text-sm font-medium ${notice.tone === "good" ? "bg-[#E3F4EF] text-good" : "bg-[#FBEDEF] text-destructive"}`}>
          {notice.text}
        </p>
      )}
      {failed ? (
        <p className="m-0 text-muted-foreground">We couldn&apos;t load your account. Refresh the page to try again.</p>
      ) : !settings ? (
        <p className="m-0 text-muted-foreground" aria-busy="true">
          Loading your account…
        </p>
      ) : (
        <>
          <ProfileCard settings={settings} />
          {/* A Google account on a Google-only site has no password to change, and can't be emailed a link to set one. */}
          {(settings.hasPassword || settings.emailLogin) && (
            <>
              <PasswordCard settings={settings} notify={notify} />
              <TwoStepCard settings={settings} notify={notify} onChange={(patch) => setSettings({ ...settings, ...patch })} />
            </>
          )}
          <DeleteCard settings={settings} onDeleted={() => setDeleted(true)} />
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[720px] flex-col gap-5 px-5 pt-10 pb-20 sm:px-6">{children}</div>
    </div>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6" aria-label={title}>
      <h2 className="m-0 flex items-center gap-2.5 font-display text-lg font-semibold">
        <span aria-hidden="true" className="text-brand">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

const muted = "m-0 text-[15px] leading-relaxed text-muted-foreground"

function FormError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="m-0 text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null
}

/** Runs a change, keeping `busy` and the error shown under the form. */
function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (e: FormEvent, work: () => Promise<string | null>) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setError(await work())
    setBusy(false)
  }
  return { busy, error, run }
}

function ProfileCard({ settings }: { settings: AccountSettings }) {
  const name = [settings.firstName, settings.lastName].filter(Boolean).join(" ")
  return (
    <Card icon={<UserRound className="size-5" />} title="Profile">
      <dl className="m-0 grid gap-3 text-[15px] sm:grid-cols-2">
        <div>
          <dt className="text-xs tracking-[0.06em] text-muted-foreground uppercase">Name</dt>
          <dd className="m-0 font-medium">{name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.06em] text-muted-foreground uppercase">Email</dt>
          <dd className="m-0 font-medium break-all">{settings.email}</dd>
        </div>
      </dl>
    </Card>
  )
}

/** For an account made with Google: a password is needed first, set with an emailed link. */
function SetPasswordFirst({ email, why, notify }: { email: string; why: string; notify?: Notify }) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  return (
    <>
      <p className={muted}>You sign in with Google, so your account has no password yet. {why}</p>
      <Button
        variant="outline"
        className="self-start"
        disabled={busy || sent}
        onClick={async () => {
          setBusy(true)
          const res = await forgotPassword(email)
          setBusy(false)
          if (res.ok) {
            setSent(true)
            notify?.(`Check your inbox: we've sent a link to set a password to ${email}.`)
          } else notify?.(res.message, "bad")
        }}
      >
        <Mail />
        {sent ? "Link sent" : "Email me a link to set a password"}
      </Button>
    </>
  )
}

function PasswordCard({ settings, notify }: { settings: AccountSettings; notify: Notify }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const { busy, error, run } = useSubmit()

  if (!settings.hasPassword) {
    return (
      <Card icon={<LockKeyhole className="size-5" />} title="Password">
        <SetPasswordFirst email={settings.email} why="Set one to also log in with your email, and to turn on two-step login." notify={notify} />
      </Card>
    )
  }

  return (
    <Card icon={<LockKeyhole className="size-5" />} title="Password">
      <p className={muted}>Changing your password logs you out on every other device.</p>
      <form
        className="flex max-w-[400px] flex-col gap-3.5"
        onSubmit={(e) =>
          run(e, async () => {
            // Read before the change: it ends this session too, and we log straight back in the same way.
            const remember = await sessionRemembered()
            const res = await changeMyPassword(current, next)
            if (res.result === undefined) return res.message
            if (res.result === "wrong-password") return WRONG_PASSWORD
            if (res.result === "no-password") return "Set a password first."
            setCurrent("")
            setNext("")
            const again = await logInWithPassword(settings.email, next, remember)
            if (again.ok) {
              notify("Password changed. You're logged out everywhere else.")
              return null
            }
            // Two-step login is on, so logging back in needs a code: do it on the log-in page.
            await logOut()
            window.location.assign("/login?next=/app/account")
            return null
          })
        }
      >
        {/* Lets password managers save the new password for the right account. */}
        <input type="hidden" autoComplete="username" value={settings.email} />
        <AuthInput label="Current password" type="password" autoComplete="current-password" value={current} onChange={setCurrent} />
        <AuthInput label="New password (8 to 72 characters)" type="password" autoComplete="new-password" value={next} onChange={setNext} />
        <FormError error={error} />
        <Button type="submit" disabled={busy || !current || next.length < 8} className="self-start">
          Change password
        </Button>
      </form>
    </Card>
  )
}

const TWO_STEP_ERRORS: Record<string, string> = {
  "wrong-password": WRONG_PASSWORD,
  "invalid-code": "That code didn't work. Use the newest one from the app, and check your phone's time is set automatically.",
  "already-on": "Two-step login is already on.",
  "not-started": "Start again: the setup timed out.",
  "not-on": "Two-step login is already off.",
}
const twoStepError = (res: { reason?: string; message?: string }) => res.message ?? TWO_STEP_ERRORS[res.reason ?? ""] ?? "That didn't go through. Please try again."

/** The QR code an authenticator app scans: dark modules on white, with the quiet zone scanners need. */
function QrCode({ modules }: { modules: boolean[][] }) {
  const size = modules.length + 8
  return (
    <svg
      className="size-48 rounded-xl border bg-white"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR code to scan with your authenticator app"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      {modules.flatMap((row, y) => row.map((dark, x) => (dark ? <rect key={`${x}-${y}`} x={x + 4} y={y + 4} width={1} height={1} fill="#000" /> : null)))}
    </svg>
  )
}

/** "ABCD EFGH IJKL …": the key in groups of four, easier to type into an app by hand */
const groups = (key: string) => key.match(/.{1,4}/g)!.join(" ")

type Setup = { step: "idle" } | { step: "password" } | { step: "scan"; secret: string; uri: string; qr: boolean[][] } | { step: "codes"; codes: string[] }

/**
 * Two-step login: set up with a password check, a QR code (or the key, or a tap on a phone), the app's first code,
 * then ten recovery codes shown once. Turning it off takes the password and a code.
 */
function TwoStepCard({ settings, notify, onChange }: { settings: AccountSettings; notify: Notify; onChange: (patch: Partial<AccountSettings>) => void }) {
  const [setup, setSetup] = useState<Setup>({ step: "idle" })
  const [turningOff, setTurningOff] = useState(false)
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const { busy, error, run } = useSubmit()
  const on = !!settings.twoFactorSince
  const reset = () => {
    setPassword("")
    setCode("")
  }
  const cancel = () => {
    reset()
    setSetup({ step: "idle" })
    setTurningOff(false)
  }
  const icon = <ShieldCheck className="size-5" />

  if (!settings.hasPassword) {
    return (
      <Card icon={icon} title="Two-step login">
        <SetPasswordFirst email={settings.email} why="Two-step login protects logging in with your email and password, so set one first." notify={notify} />
      </Card>
    )
  }

  const intro = (
    <p className={muted}>
      After your password, logging in also asks for a 6-digit code from an authenticator app on your phone: Google Authenticator, Microsoft
      Authenticator, 1Password or Authy. Logging in with Google relies on your Google account&apos;s own security.
    </p>
  )
  const actions = "flex flex-wrap gap-2.5"

  let body
  if (setup.step === "codes") {
    const text = `Crema recovery codes for ${settings.email}\n\n${setup.codes.join("\n")}\n\nEach code works once, instead of a code from your app.\n`
    body = (
      <>
        <p className="m-0 flex items-center gap-2 font-medium text-good">
          <CircleCheck aria-hidden="true" className="size-5" />
          Two-step login is on.
        </p>
        <p className={muted}>
          Save these recovery codes somewhere safe, like a password manager. If you lose your phone, each one logs you in once instead of a code.{" "}
          <strong className="text-foreground">They won&apos;t be shown again.</strong>
        </p>
        <ol aria-label="Recovery codes" className="m-0 grid list-none grid-cols-2 gap-2 rounded-xl bg-subtle p-4 font-mono text-[15px] sm:grid-cols-5">
          {setup.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <div className={actions}>
          <Button
            variant="outline"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
              Object.assign(document.createElement("a"), { href: url, download: "crema-recovery-codes.txt" }).click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download />
            Download
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                notify("Your recovery codes are on the clipboard.")
              } catch {
                notify("Couldn't copy: select the codes and copy them, or use Download.", "bad")
              }
            }}
          >
            Copy
          </Button>
          <Button onClick={() => setSetup({ step: "idle" })}>I&apos;ve saved them</Button>
        </div>
      </>
    )
  } else if (setup.step === "scan") {
    body = (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) =>
          run(e, async () => {
            const res = await enableTwoStep(code)
            if (!res.ok) return twoStepError(res)
            reset()
            onChange({ twoFactorSince: new Date().toISOString(), recoveryCodesLeft: res.recoveryCodes.length })
            setSetup({ step: "codes", codes: res.recoveryCodes })
            return null
          })
        }
      >
        <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[15px] leading-relaxed">
          <li>Open your authenticator app and add an account (often a + button).</li>
          <li>
            Scan this QR code, or on this phone, <a href={setup.uri}>open it in the app</a>.
          </li>
          <li>Enter the 6-digit code the app shows for Crema.</li>
        </ol>
        <QrCode modules={setup.qr} />
        <p className="m-0 text-[13px] text-muted-foreground">
          Can&apos;t scan? Choose to enter a key, and type: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{groups(setup.secret)}</code>{" "}
          (time-based)
        </p>
        <div className="max-w-[260px]">
          <AuthInput label="Code from the app" inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" maxLength={7} value={code} onChange={setCode} />
        </div>
        <FormError error={error} />
        <div className={actions}>
          <Button type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6}>
            Turn on
          </Button>
          <Button variant="ghost" disabled={busy} onClick={cancel}>
            Cancel
          </Button>
        </div>
      </form>
    )
  } else if (setup.step === "password") {
    body = (
      <form
        className="flex max-w-[400px] flex-col gap-3.5"
        onSubmit={(e) =>
          run(e, async () => {
            const res = await startTwoStep(password)
            if (!res.ok) return twoStepError(res)
            reset()
            setSetup({ step: "scan", secret: res.secret, uri: res.uri, qr: res.qr })
            return null
          })
        }
      >
        <input type="hidden" autoComplete="username" value={settings.email} />
        <AuthInput label="Your password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        <FormError error={error} />
        <div className={actions}>
          <Button type="submit" disabled={busy || !password}>
            Continue
          </Button>
          <Button variant="ghost" disabled={busy} onClick={cancel}>
            Cancel
          </Button>
        </div>
      </form>
    )
  } else if (on && turningOff) {
    body = (
      <form
        className="flex max-w-[400px] flex-col gap-3.5"
        onSubmit={(e) =>
          run(e, async () => {
            const res = await disableTwoStep(password, code)
            if (!res.ok) return twoStepError(res)
            reset()
            setTurningOff(false)
            onChange({ twoFactorSince: null, recoveryCodesLeft: 0 })
            notify("Two-step login is off. Logging in now only needs your email and password.")
            return null
          })
        }
      >
        <input type="hidden" autoComplete="username" value={settings.email} />
        <AuthInput label="Your password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        <AuthInput label="Code from the app, or a recovery code" autoComplete="one-time-code" maxLength={11} value={code} onChange={setCode} />
        <FormError error={error} />
        <div className={actions}>
          <Button type="submit" variant="destructive" disabled={busy || !password || code.trim().length < 6}>
            Turn off two-step login
          </Button>
          <Button variant="ghost" disabled={busy} onClick={cancel}>
            Cancel
          </Button>
        </div>
      </form>
    )
  } else if (on) {
    body = (
      <>
        <p className="m-0 flex flex-wrap items-center gap-2 text-[15px] font-medium text-good">
          <CircleCheck aria-hidden="true" className="size-5" />
          On since {new Date(settings.twoFactorSince!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
          <span className="font-normal text-muted-foreground">{settings.recoveryCodesLeft} of 10 recovery codes left.</span>
        </p>
        <Button variant="outline" className="self-start" onClick={() => setTurningOff(true)}>
          Turn off
        </Button>
      </>
    )
  } else {
    body = (
      <Button className="self-start" onClick={() => setSetup({ step: "password" })}>
        <KeyRound />
        Turn on two-step login
      </Button>
    )
  }

  return (
    <Card icon={icon} title="Two-step login">
      {setup.step !== "codes" && intro}
      {body}
    </Card>
  )
}

function DeleteCard({ settings, onDeleted }: { settings: AccountSettings; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState("")
  const [loginAgain, setLoginAgain] = useState(false)
  const { busy, error, run } = useSubmit()

  return (
    <Card icon={<Trash2 className="size-5" />} title="Delete account">
      <p className={muted}>
        Deletes your account and every figure in it, for good. Export the months you want to keep first (Export month, in the calculator).
      </p>
      {confirming ? (
        <form
          aria-label="Confirm deleting your account"
          className="flex max-w-[420px] flex-col gap-3.5 rounded-xl border border-destructive/30 bg-[#FBEDEF]/60 p-4"
          onSubmit={(e) =>
            run(e, async () => {
              const res = await deleteMyAccount(settings.hasPassword ? password : undefined)
              if (res.result === undefined) return res.message
              if (res.result === "wrong-password") return WRONG_PASSWORD
              if (res.result === "login-again") {
                setLoginAgain(true)
                return "To keep your account safe, log in with Google again first, then delete it within 10 minutes."
              }
              await logOut()
              onDeleted()
              return null
            })
          }
        >
          {settings.hasPassword ? (
            <>
              <p className="m-0 text-sm font-medium text-destructive">This can&apos;t be undone. Enter your password to delete your account.</p>
              <input type="hidden" autoComplete="username" value={settings.email} />
              <AuthInput label="Your password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
            </>
          ) : (
            <p className="m-0 text-sm font-medium text-destructive">This can&apos;t be undone.</p>
          )}
          <FormError error={error} />
          <div className="flex flex-wrap gap-2.5">
            {/* An account made with Google proves it's the owner with a fresh Google log in, then comes back here. */}
            {loginAgain ? (
              <Button disabled={busy} onClick={() => void continueWithGoogle("/app/account")}>
                Log in with Google again
              </Button>
            ) : (
              <Button type="submit" className="bg-destructive hover:bg-destructive/90" disabled={busy || (settings.hasPassword && !password)}>
                Delete my account for good
              </Button>
            )}
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="destructive" className="self-start" onClick={() => setConfirming(true)}>
          <Trash2 />
          Delete my account
        </Button>
      )}
    </Card>
  )
}
