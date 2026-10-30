"use client"

import { useCallback, useRef, useState } from "react"
import { Bell, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCloseOnOutside } from "@/hooks/useCloseOnOutside"
import type { Alert } from "@/lib/alerts"

/** A bell with how many warnings the month has; opens a list of them, each of which can be dismissed. */
export function AlertBell({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useCloseOnOutside(open, useCallback(() => setOpen(false), []), root, button)

  const count = alerts.length
  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={count ? `Alerts: ${count}` : "Alerts: none"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-11 cursor-pointer items-center justify-center rounded-xl border bg-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell aria-hidden="true" className="size-[18px]" />
        {count > 0 && (
          <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-20 flex w-[min(340px,calc(100vw-48px))] flex-col gap-0.5 rounded-xl border bg-card p-1.5 shadow-[0_12px_32px_rgba(42,29,22,0.14)]">
          {count === 0 && <p className="m-0 px-2.5 py-2 text-[13px] text-muted-foreground">Nothing to worry about this month.</p>}
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-1 rounded-lg py-2 pl-2.5 hover:bg-accent">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-[13px] text-muted-foreground">{a.detail}</div>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Dismiss: ${a.title}`} onClick={() => onDismiss(a.id)} className="text-muted-foreground">
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
