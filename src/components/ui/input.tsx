import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "selection:bg-brand selection:text-white border-input flex h-11 w-full min-w-0 rounded-lg border bg-card px-3 text-[15px] font-medium text-foreground transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
      {...props}
    />
  )
}

/** Numeric input: monospace, right-aligned, decimal keyboard on mobile. */
function NumberInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder="0"
      className={cn("font-mono text-right", className)}
      {...props}
    />
  )
}

/** A label wrapping its control, caption above. */
function Field({
  label,
  className,
  children,
}: {
  label: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 flex-col gap-1 text-xs text-muted-foreground",
        className
      )}
    >
      {label}
      {children}
    </label>
  )
}

export { Input, NumberInput, Field }
