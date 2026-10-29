"use client"

import type { View } from "@/components/expenses/AppHeader"
import { Button } from "@/components/ui/button"
import { Card, CardTitle, Eyebrow } from "@/components/ui/card"
import { NumberInput } from "@/components/ui/input"
import { type MonthData, monthDate, num } from "@/lib/expenses"
import { WEEKDAYS, takingsSummary } from "@/lib/takings"
import { cn } from "@/lib/utils"

type Mutate = (fn: (m: MonthData) => void) => void
type Fmt = (n: number) => string

const GOOD = "bg-[#E3F4EF] text-good"
const BAD = "bg-[#FDEEF1] text-destructive"

/**
 * Daily takings: a calendar of the month to type each day's till total into, coloured against the day's share of
 * what's needed to break even, with how the month stands and what each day left must take.
 */
export function TakingsView({
  month,
  monthKey,
  total,
  mutate,
  fmt,
  onView,
}: {
  month: MonthData
  monthKey: string
  /** The month's costs */
  total: number
  mutate: Mutate
  fmt: Fmt
  onView: (view: View) => void
}) {
  const t = takingsSummary(month, total, monthKey)
  const start = monthDate(monthKey)
  const dayName = (day: number) => new Date(start.getFullYear(), start.getMonth(), day).toLocaleString("en-GB", { day: "numeric", month: "long" })
  const set = (day: number, v: string) =>
    mutate((m) => {
      if (v.trim()) m.takings[day] = v
      else delete m.takings[day]
    })
  const covered = t.logged > 0 && t.short === 0
  const expected = t.target * t.logged
  const best = Math.max(...t.byWeekday.map((w) => w.average), 0)
  const sales = Math.round(t.takenNet)

  if (total <= 0) {
    return (
      <Card className="items-start p-7">
        <CardTitle>Add this month&apos;s costs first</CardTitle>
        <p className="m-0 text-sm text-muted-foreground">Your daily target is your costs shared over the days you open, so it needs your expenses.</p>
        <Button onClick={() => onView("calc")}>Go to Expenses</Button>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 max-w-[680px] text-sm text-muted-foreground">
        Type in what the till took each day, VAT included. The daily target is what you need to cover this month&apos;s costs, shared over
        your {t.openDays} opening days, with {Math.round(t.vat * 100)}% average VAT on top.
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Card className="gap-1">
          <Eyebrow>Taken so far</Eyebrow>
          <div className="font-display text-xl font-semibold">{fmt(t.taken)}</div>
          <div className="text-sm text-muted-foreground">
            {t.logged} of {t.openDays} opening days in
          </div>
        </Card>
        <Card className="gap-1">
          <Eyebrow>Needed this month</Eyebrow>
          <div className="font-display text-xl font-semibold">{fmt(t.needed)}</div>
          <div className="text-sm text-muted-foreground">{fmt(total)} of costs, plus VAT</div>
        </Card>
        <Card className="gap-1">
          <Eyebrow>Daily target</Eyebrow>
          <div className="font-display text-xl font-semibold">{fmt(t.target)}</div>
          <div className="text-sm text-muted-foreground">
            {t.logged > 0 ? `Hit on ${t.good} of ${t.logged} days` : "On each opening day"}
          </div>
        </Card>
        <Card className={cn("gap-1", covered ? GOOD : t.left === 0 && t.logged > 0 ? BAD : "")}>
          {covered ? (
            <>
              <Eyebrow className="text-inherit">Costs covered</Eyebrow>
              <div className="font-display text-xl font-semibold">{fmt(t.taken - t.needed)} over</div>
              <div className="text-sm">Everything from here is profit.</div>
            </>
          ) : t.left === 0 ? (
            <>
              <Eyebrow className={t.logged > 0 ? "text-inherit" : ""}>Short of break-even</Eyebrow>
              <div className="font-display text-xl font-semibold">{fmt(t.short)}</div>
              <div className="text-sm">No opening days left this month.</div>
            </>
          ) : (
            <>
              <Eyebrow>Needed per day from here</Eyebrow>
              <div className={cn("font-display text-xl font-semibold", t.logged > 0 && (t.perDayLeft > t.target ? "text-destructive" : "text-good"))}>
                {fmt(t.perDayLeft)}
              </div>
              <div className="text-sm text-muted-foreground">
                Over the {t.left} opening day{t.left === 1 ? "" : "s"} left
              </div>
            </>
          )}
        </Card>
      </div>

      <Card className="gap-2.5">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="font-semibold">
            {fmt(t.taken)} of {fmt(t.needed)}
          </span>
          {t.logged > 0 && (
            <span className={t.taken >= expected ? "text-good" : "text-destructive"}>
              {t.taken >= expected ? `${fmt(t.taken - expected)} ahead of target` : `${fmt(expected - t.taken)} behind target`} for the days in
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Taken towards break-even"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(Math.round((t.taken / t.needed) * 100), 100)}
          className="relative h-3 rounded-full bg-track"
        >
          <span className={cn("block h-3 rounded-full", covered ? "bg-good" : "bg-brand")} style={{ width: `${Math.min((t.taken / t.needed) * 100, 100)}%` }} />
          {t.logged > 0 && expected < t.needed && (
            <span aria-hidden="true" className="absolute -top-1 h-5 w-0.5 rounded bg-espresso" style={{ left: `${(expected / t.needed) * 100}%` }} />
          )}
        </div>
        {t.logged > 0 && (
          <p className="m-0 text-[13px] text-muted-foreground">
            The line marks the target for the {t.logged} day{t.logged === 1 ? "" : "s"} in. At this pace the month takes about {fmt(t.pace)}.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Takings by day" className="min-w-0 flex-[3_1_520px] rounded-2xl border bg-card p-4 sm:p-5">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-center text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                {w}
              </div>
            ))}
            {Array.from({ length: t.days[0].weekday }, (_, i) => (
              <div key={`blank${i}`} />
            ))}
            {t.days.map((d) => (
              <label
                key={d.day}
                className={cn(
                  "flex min-w-0 flex-col gap-1 rounded-lg border p-1 sm:p-1.5",
                  d.logged ? (d.amount >= t.target ? "border-transparent " + GOOD : "border-transparent " + BAD) : "border-line bg-subtle",
                )}
              >
                <span className="px-0.5 text-xs font-semibold">
                  {d.day}
                  <span className="sr-only"> {dayName(d.day)}, takings incl. VAT</span>
                </span>
                <NumberInput
                  value={month.takings[d.day] ?? ""}
                  placeholder="–"
                  onChange={(e) => set(d.day, e.target.value)}
                  className="h-9 px-1 text-[13px] text-foreground sm:px-2"
                />
              </label>
            ))}
          </div>
          <p className="m-0 pt-3 text-[13px] text-muted-foreground">
            Green days took at least {fmt(t.target)}; red days took less. Leave days you were closed blank.
          </p>
        </section>

        <aside className="flex min-w-0 flex-[2_1_300px] flex-col gap-4">
          <Card>
            <CardTitle>Your days of the week</CardTitle>
            {t.logged === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">Once a few days are in, you&apos;ll see which days earn the most.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {t.byWeekday.map((w) => (
                  <div key={w.label} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    <span className="font-semibold">{w.label}</span>
                    <span className="block h-2 rounded-full bg-track">
                      <span
                        className={cn("block h-2 rounded-full", w.average >= t.target ? "bg-good" : "bg-crema")}
                        style={{ width: `${best > 0 ? Math.round((w.average / best) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="font-mono text-[13px]">{w.days ? fmt(w.average) : "—"}</span>
                  </div>
                ))}
                <p className="m-0 text-[13px] text-muted-foreground">Average takings on each day of the week, from the days in.</p>
              </div>
            )}
          </Card>

          {t.logged > 0 && (
            <Card>
              <CardTitle>Month&apos;s sales</CardTitle>
              <p className="m-0 text-sm text-muted-foreground">
                Without VAT, your takings so far come to about {fmt(sales)}. Profit on Menu &amp; sales uses the month&apos;s sales
                {String(month.revenue).trim() ? `, now ${fmt(num(month.revenue))}` : ", not typed in yet"}.
              </p>
              <Button
                variant="outline"
                className="self-start"
                disabled={num(month.revenue) === sales && String(month.revenue).trim() !== ""}
                onClick={() => mutate((m) => void (m.revenue = String(sales)))}
              >
                Use {fmt(sales)} as this month&apos;s sales
              </Button>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
