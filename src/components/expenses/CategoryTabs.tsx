import { type CategoryKey, CATEGORIES, type Totals } from "@/lib/expenses"
import { cn } from "@/lib/utils"

interface CategoryTabsProps {
  active: CategoryKey
  totals: Totals
  fmt: (n: number) => string
  onPick: (key: CategoryKey) => void
}

export function CategoryTabs({ active, totals, fmt, onPick }: CategoryTabsProps) {
  return (
    <div role="tablist" aria-label="Expense categories" className="flex flex-wrap gap-2">
      {CATEGORIES.map((c) => {
        const on = c.key === active
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(c.key)}
            className={cn(
              "flex min-h-12 cursor-pointer flex-col items-start rounded-[10px] border px-4 py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent"
            )}
          >
            <span className="text-sm font-semibold">{c.label}</span>
            <span className={cn("font-mono text-xs", on ? "text-[#E3D5C5]" : "text-muted-foreground")}>
              {fmt(totals[c.key])}
            </span>
          </button>
        )
      })}
    </div>
  )
}
