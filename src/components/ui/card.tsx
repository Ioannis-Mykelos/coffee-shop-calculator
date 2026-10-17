import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-2xl border bg-card p-5 text-card-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("m-0 font-display text-[17px] font-bold", className)}
      {...props}
    />
  )
}

/** Small uppercase caption used above figures. */
function Eyebrow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-xs uppercase tracking-[0.06em] text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Colored square used in legends. */
function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", className)}
      style={{ background: color }}
    />
  )
}

export { Card, CardTitle, Eyebrow, Swatch }
