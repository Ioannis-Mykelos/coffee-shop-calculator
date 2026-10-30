import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Field, NumberInput } from "@/components/ui/input"
import { type MonthData, menuSales, profitOf } from "@/lib/expenses"
import { STAFF_RANGE, type StaffShareStatus, staffShare } from "@/lib/staff-share"
import { cn } from "@/lib/utils"

type Mutate = (fn: (m: MonthData) => void) => void
type Fmt = (n: number) => string

const pct = (v: number) => (v * 100).toFixed(1).replace(".", ",") + "%"

const STAFF_HINT: Record<StaffShareStatus, string> = {
  low: "Below the usual range. Good if the shifts are covered; check every wage is in Staff.",
  healthy: "Within the usual range.",
  high: "Above the usual range. Look at the rota, or at what the busiest hours sell.",
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-3", className)}>
      <span>{label}</span>
      <strong className="font-mono font-medium">{value}</strong>
    </div>
  )
}

/**
 * The month's sales and the profit or loss they leave after all costs. Sales follow the menu (its prices × how many of
 * each sell) until the owner types the actual takings in.
 */
export function ProfitCard({ month, total, fmt, mutate }: { month: MonthData; total: number; fmt: Fmt; mutate: Mutate }) {
  const p = profitOf(month, total)
  const loss = p ? p.profit < 0 : false
  const fromMenu = menuSales(month)
  const typed = month.revenue.trim() !== ""
  return (
    <Card>
      <CardTitle>Sales &amp; profit</CardTitle>
      <Field label="Sales this month, excl. VAT">
        <NumberInput
          value={month.revenue}
          placeholder={fromMenu > 0 ? String(Math.round(fromMenu)) : "Enter takings"}
          onChange={(e) => {
            const v = e.target.value
            mutate((m) => void (m.revenue = v))
          }}
        />
      </Field>
      {fromMenu > 0 &&
        (typed ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
            <span>Your actual takings. Your menu works out to {fmt(fromMenu)}.</span>
            <Button variant="outline" size="sm" onClick={() => mutate((m) => void (m.revenue = ""))}>
              Use the menu&apos;s figure
            </Button>
          </div>
        ) : (
          <p className="m-0 text-[13px] text-muted-foreground">
            Worked out from what your menu sells, and kept up to date as you change it. Type your actual takings to use them instead.
          </p>
        ))}
      {p ? (
        <div className="flex flex-col gap-1.5 text-sm">
          <Row label="Sales" value={fmt(p.revenue)} />
          <Row label="Expenses" value={"− " + fmt(total)} />
          <div
            className={cn(
              "mt-1 flex justify-between rounded-[10px] px-3 py-2.5",
              loss ? "bg-[#FDEEF1] text-destructive" : "bg-[#E3F4EF] text-good",
            )}
          >
            <span className="font-semibold">{loss ? "Loss" : "Profit"}</span>
            <strong className="font-mono font-medium">{fmt(Math.abs(p.profit))}</strong>
          </div>
          <Row label="Profit margin" value={p.revenue > 0 ? pct(p.margin) : "—"} className="mt-1" />
          <Row
            label={loss ? "Below break-even by" : "Above break-even by"}
            value={total > 0 ? pct(Math.abs(p.coverage - 1)) : "—"}
          />
          {p.customersNeededDay > 0 && (
            <p className="m-0 mt-1 text-[13px] text-muted-foreground">
              About {Math.round(p.customersDay).toLocaleString("en-GB")} customers a day at your average sale, against{" "}
              {p.customersNeededDay.toLocaleString("en-GB")} needed to break even.
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 text-[13px] text-muted-foreground">
          Type in what the shop took this month, or how many of each item you sell on the menu, to see the profit or loss and how far you are from break-even.
        </p>
      )}
    </Card>
  )
}

/** Wages as a share of the month's sales, against the range that's healthy for a café. */
export function StaffShareCard({ month, fmt }: { month: MonthData; fmt: Fmt }) {
  const r = staffShare(month)
  const range = `${STAFF_RANGE.low * 100}–${STAFF_RANGE.high * 100}%`
  return (
    <Card>
      <CardTitle>Staff cost as % of sales</CardTitle>
      {r ? (
        <>
          <div className={cn("font-display text-[32px] font-bold", r.status === "high" ? "text-destructive" : r.status === "healthy" && "text-good")}>
            {pct(r.share)}
          </div>
          <p className="m-0 text-[13px] text-muted-foreground">
            {fmt(r.staff)} of staff cost on {fmt(r.sales)} of sales. {STAFF_HINT[r.status]} Cafés usually run at about {range}.
          </p>
        </>
      ) : (
        <p className="m-0 text-[13px] text-muted-foreground">
          Add your staff and this month&apos;s sales to see how they compare. Cafés usually run at about {range}.
        </p>
      )}
    </Card>
  )
}
