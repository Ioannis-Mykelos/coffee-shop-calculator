import { ChartColumn, ChevronLeft, ChevronRight, Coffee, Download } from "lucide-react"

import { Button } from "@/components/ui/button"

interface AppHeaderProps {
  monthLabel: string
  isAnalytics: boolean
  exportMsg: string
  onPrev: () => void
  onNext: () => void
  onToggleView: () => void
  onSubmit: () => void
}

export function AppHeader({ monthLabel, isAnalytics, exportMsg, onPrev, onNext, onToggleView, onSubmit }: AppHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand text-white">
          <Coffee aria-hidden="true" className="size-[26px]" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="m-0 font-display text-[26px] font-bold tracking-[-0.01em]">My Coffee Shop</h1>
          <div className="text-sm text-muted-foreground">Monthly expenses calculator</div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2 rounded-xl border bg-card p-1">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={onPrev}>
              <ChevronLeft className="size-5" />
            </Button>
            <div className="min-w-40 text-center font-display text-lg font-bold">{monthLabel}</div>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={onNext}>
              <ChevronRight className="size-5" />
            </Button>
          </div>
          <Button variant="outline" size="lg" aria-pressed={isAnalytics} onClick={onToggleView}>
            {isAnalytics ? <ChevronLeft className="size-[18px]" /> : <ChartColumn className="size-[18px]" />}
            <span>{isAnalytics ? "Back to calculator" : "Analytics"}</span>
          </Button>
          <Button size="lg" className="px-[22px]" onClick={onSubmit}>
            <Download className="size-[18px]" />
            <span>Submit month</span>
          </Button>
        </div>
        {exportMsg && (
          <div role="status" className="text-[13px] text-muted-foreground">
            {exportMsg}
          </div>
        )}
      </div>
    </header>
  )
}
