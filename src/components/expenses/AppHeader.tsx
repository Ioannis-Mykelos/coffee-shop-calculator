"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  Calculator,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudAlert,
  CloudCheck,
  Coffee,
  Download,
  LoaderCircle,
  LogOut,
  Settings,
  SlidersHorizontal,
} from "lucide-react"

import { CremaLogo } from "@/components/brand/Logo"
import { Button } from "@/components/ui/button"
import type { SaveStatus } from "@/hooks/useExpensesStore"
import { type User, logOut } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export type View = "calc" | "menu" | "whatif" | "analytics"

/** The four views, with each one's heading and the line under it. */
const VIEWS: { key: View; label: string; Icon: typeof Calculator; title: string; sub: (month: string) => string }[] = [
  { key: "calc", label: "Expenses", Icon: Calculator, title: "Monthly expenses", sub: (m) => `Costs, cup prices and break-even for ${m}` },
  { key: "menu", label: "Menu", Icon: Coffee, title: "Your menu", sub: (m) => `What each drink costs to make and earns you, ${m}` },
  { key: "whatif", label: "What if", Icon: SlidersHorizontal, title: "What if…", sub: (m) => `Try a change on ${m}'s figures before it happens` },
  { key: "analytics", label: "Analytics", Icon: ChartColumn, title: "Analytics", sub: () => "Your months side by side" },
]

interface AppHeaderProps {
  monthLabel: string
  /** The signed-in owner (accounts mode) */
  user?: User
  /** Accounts mode: where saving stands; null in local mode */
  saveStatus: SaveStatus | null
  view: View
  exportMsg: string
  onPrev: () => void
  onNext: () => void
  onView: (view: View) => void
  onSubmit: () => void
  /** Shown on the right of the view tabs (the location and currency) */
  toolbar?: React.ReactNode
}

export function AppHeader({ monthLabel, user, saveStatus, view, exportMsg, onPrev, onNext, onView, onSubmit, toolbar }: AppHeaderProps) {
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0]
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label="Crema home" className="rounded-lg">
          <CremaLogo />
        </Link>
        <div className="flex items-center gap-3">
          {saveStatus && <SaveIndicator status={saveStatus} />}
          {user && <UserMenu user={user} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-[26px] font-semibold tracking-[-0.01em]">{current.title}</h1>
          <div className="text-sm text-muted-foreground">{current.sub(monthLabel)}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-xl border bg-card p-1">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={onPrev}>
                <ChevronLeft className="size-5" />
              </Button>
              <div className="min-w-40 text-center font-display text-lg font-semibold">{monthLabel}</div>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={onNext}>
                <ChevronRight className="size-5" />
              </Button>
            </div>
            <Button size="lg" className="px-[22px]" onClick={onSubmit}>
              <Download className="size-[18px]" />
              <span>Export month</span>
            </Button>
          </div>
          {exportMsg && (
            <div role="status" className="text-[13px] text-muted-foreground">
              {exportMsg}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Views" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border bg-card p-1">
          {VIEWS.map(({ key, label, Icon }) => {
            const on = key === view
            return (
              <button
                key={key}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onView(key)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on ? "bg-primary text-primary-foreground" : "bg-transparent text-ink-2 hover:bg-accent",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </button>
            )
          })}
        </nav>
        {toolbar}
      </div>
    </header>
  )
}

const SAVE_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  failed: "Not saved: retrying on your next change",
  conflict: "Updated from another device",
}

/** Where saving to the account stands; read out when it changes. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  const Icon = status === "saving" ? LoaderCircle : status === "failed" ? CloudAlert : CloudCheck
  return (
    <span role="status" className={`flex items-center gap-1.5 text-[13px] ${status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
      <Icon aria-hidden="true" className={`size-4 ${status === "saving" ? "animate-spin" : ""}`} />
      {SAVE_TEXT[status]}
    </span>
  )
}

const initials = (u: User) => ((u.firstName[0] ?? "") + (u.lastName[0] ?? "")).toUpperCase() || u.email[0].toUpperCase()

/** The owner's name, with Account and Log out. Closes on Escape or a click outside. */
function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-card py-1 pr-2.5 pl-1 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-espresso text-xs font-semibold text-cream">
          {initials(user)}
        </span>
        <span className="max-w-40 truncate">{name}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-20 flex w-64 flex-col gap-0.5 rounded-xl border bg-card p-1.5 shadow-[0_12px_32px_rgba(42,29,22,0.14)]">
          <div className="px-2.5 py-2 text-[13px] text-muted-foreground">
            Signed in as <span className="block truncate font-medium text-foreground">{user.email}</span>
          </div>
          <Link
            href="/app/account"
            className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings aria-hidden="true" className="size-4 text-muted-foreground" />
            Account &amp; security
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logOut()
              window.location.assign("/")
            }}
            className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium hover:bg-accent"
          >
            <LogOut aria-hidden="true" className="size-4 text-muted-foreground" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
