import { CloudAlert, CloudUpload } from "lucide-react"

import { Button } from "@/components/ui/button"

/** A new account, and this browser has figures from before: bring them in, or start fresh. */
export function ImportBanner({ months, onAnswer }: { months: number; onAnswer: (accept: boolean) => void }) {
  return (
    <section
      aria-labelledby="import-title"
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/30 bg-brand-soft px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <CloudUpload aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-strong" />
        <div>
          <h2 id="import-title" className="m-0 text-[15px] font-semibold text-brand-ink">
            Bring your figures into your account?
          </h2>
          <p className="m-0 text-sm text-brand-ink/80">
            This browser has {months} {months === 1 ? "month" : "months"} of figures saved from before you had an account. Import them to see them on
            every device.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => onAnswer(false)}>
          Start fresh
        </Button>
        <Button onClick={() => onAnswer(true)}>Import my figures</Button>
      </div>
    </section>
  )
}

/** The account's figures couldn't be loaded. */
export function LoadFailed() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
        <CloudAlert aria-hidden="true" className="size-10 text-destructive" />
        <h1 className="m-0 font-display text-2xl font-semibold">We couldn&apos;t load your figures</h1>
        <p className="m-0 text-muted-foreground">Check your connection, then try again. Nothing you saved is lost.</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    </div>
  )
}
