"use client"

import { useState } from "react"

import { Card, CardTitle, Eyebrow, Swatch } from "@/components/ui/card"
import {
  CATEGORIES,
  type CategoryKey,
  type Currency,
  type MonthsData,
  compactFormatter,
  computeTotals,
  monthLabel,
  monthShort,
  num,
  breakEven,
  profitOf,
} from "@/lib/expenses"
import { cn } from "@/lib/utils"

type Period = "month" | "quarter" | "half" | "year"

const PERIODS: Record<Period, { label: string; noun: string; n: number }> = {
  month: { label: "Monthly", noun: "month", n: 1 },
  quarter: { label: "3 months", noun: "quarter (3 months)", n: 3 },
  half: { label: "6 months", noun: "half-year (6 months)", n: 6 },
  year: { label: "Yearly", noun: "year", n: 12 },
}

const UP = "var(--destructive)", DOWN = "var(--good)", FLAT = "var(--muted-foreground)"

interface Bucket {
  months: { key: string; total: number }[]
  t: Record<CategoryKey | "total", number>
  cust: number
  days: number
  /** Sales, and the expenses of only those months that have sales entered. */
  sales: number
  salesCost: number
  salesMonths: number
}

function bucketOf(period: Period, k: string) {
  const y = k.slice(0, 4), mo = +k.slice(5, 7)
  if (period === "month") return k
  if (period === "quarter") return `${y}-Q${Math.ceil(mo / 3)}`
  if (period === "half") return `${y}-H${mo <= 6 ? 1 : 2}`
  return y
}

function bucketShort(period: Period, b: string) {
  if (period === "month") return monthShort(b)
  if (period === "year") return b
  return `${b.slice(5)} ${b.slice(2, 4)}`
}

function bucketLong(period: Period, b: string) {
  if (period === "month") return monthLabel(b)
  if (period === "year") return b
  const n = +b.slice(6), y = b.slice(0, 4)
  if (period === "quarter") return `Q${n} ${y} (${["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][n - 1]})`
  return `H${n} ${y} (${n === 1 ? "Jan–Jun" : "Jul–Dec"})`
}

function change(hasPrev: boolean, cur: number, prev: number) {
  if (!hasPrev || prev <= 0) return { text: "—", color: FLAT }
  const v = ((cur - prev) / prev) * 100
  if (Math.abs(v) < 0.05) return { text: "0,0%", color: FLAT }
  const pct = ((v > 0 ? "+" : "") + v.toFixed(1) + "%").replace(".", ",")
  return { text: (v > 0 ? "▲ " : "▼ ") + pct, color: v > 0 ? UP : DOWN }
}

function profitKpi(g: Bucket, fmt: (n: number) => string) {
  if (!g.salesMonths) return { label: "Profit", value: "—", sub: "Enter actual sales to see profit", color: undefined }
  const p = g.sales - g.salesCost
  const margin = g.sales > 0 ? ((p / g.sales) * 100).toFixed(1).replace(".", ",") + "% margin" : "No sales"
  const n = g.months.length
  return {
    label: p < 0 ? "Loss" : "Profit",
    value: fmt(Math.abs(p)),
    sub: `${margin}${g.salesMonths < n ? ` · ${g.salesMonths} of ${n} months with sales` : ""}`,
    color: p < 0 ? UP : DOWN,
  }
}

const tabClass =
  "min-h-11 cursor-pointer rounded-lg px-4 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

const tableGrid = "grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-3"

export function AnalyticsView({ data, month, fmt, currency }: { data: MonthsData; month: string; fmt: (n: number) => string; currency: Currency }) {
  const [period, setPeriod] = useState<Period>("month")
  const [picked, setPicked] = useState<string | null>(null)
  const cf = compactFormatter(currency)

  const groups: Record<string, Bucket> = {}
  const order: string[] = []
  for (const k of Object.keys(data).sort()) {
    const b = bucketOf(period, k), md = data[k], tt = computeTotals(md)
    if (!groups[b]) {
      groups[b] = { months: [], t: { premises: 0, utilities: 0, supplies: 0, staff: 0, other: 0, total: 0 }, cust: 0, days: 0, sales: 0, salesCost: 0, salesMonths: 0 }
      order.push(b)
    }
    const g = groups[b]
    g.months.push({ key: k, total: tt.total })
    for (const c of CATEGORIES) g.t[c.key] += tt[c.key]
    g.t.total += tt.total
    const p = profitOf(md, tt.total)
    if (p) {
      g.sales += p.revenue
      g.salesCost += tt.total
      g.salesMonths++
    }
    const a = breakEven(md, tt.total).avg, dd = num(md.days)
    if (a > 0 && dd > 0) {
      g.cust += tt.total / a
      g.days += dd
    }
  }

  const shown = order.slice(-12)
  const sel = picked && shown.includes(picked) ? picked : shown[shown.length - 1]
  const maxB = Math.max(...shown.map((b) => groups[b].t.total), 1)
  const sg = groups[sel]
  const sIdx = order.indexOf(sel)
  const prevB = sIdx > 0 ? order[sIdx - 1] : null
  const pg = prevB ? groups[prevB] : null
  const nM = sg.months.length
  const sAvg = sg.t.total / nM
  const pAvg = pg ? pg.t.total / pg.months.length : 0
  const totChg = change(!!pg, sAvg, pAvg)
  const share = (v: number) => (sg.t.total ? Math.round((v / sg.t.total) * 100) : 0)
  const big = [...CATEGORIES].sort((a, b) => sg.t[b.key] - sg.t[a.key])[0]
  const expected = PERIODS[period].n
  const isMonth = period === "month"

  const kpis = [
    { label: "Total expenses", value: fmt(sg.t.total), sub: bucketLong(period, sel), color: undefined },
    { label: "Average per month", value: fmt(sAvg), sub: `${nM} of ${expected} ${expected === 1 ? "month" : "months"} entered`, color: undefined },
    {
      label: "Change vs previous",
      value: pg ? totChg.text : "—",
      sub: pg && prevB ? `Per month, vs ${bucketShort(period, prevB)}` : `No earlier ${isMonth ? "month" : "period"} to compare`,
      color: totChg.color,
    },
    { label: "Biggest cost", value: big.label, sub: `${fmt(sg.t[big.key])} · ${share(sg.t[big.key])}% of total`, color: undefined },
    profitKpi(sg, fmt),
    { label: "Customers needed / day", value: sg.days ? Math.ceil(sg.cust / sg.days).toLocaleString("en-GB") : "—", sub: "To cover all costs", color: undefined },
  ]

  const maxMo = Math.max(...sg.months.map((x) => x.total), 1)
  const monthsNote =
    expected === 1
      ? "Switch to 3 months, 6 months or yearly to compare several months."
      : nM < expected
        ? `${expected - nM} month${expected - nM === 1 ? "" : "s"} of this period not entered yet.`
        : "All months of this period are entered."
  const chartNote =
    order.length < 2
      ? `Only one ${isMonth ? "month" : "period"} has figures so far. Use the arrows next to the month to add more months and the trend will build up here.`
      : `Showing the last ${shown.length} ${isMonth ? "months" : "periods"} with figures.`

  return (
    <section aria-label="Analytics" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="m-0 font-display text-2xl font-bold">Analytics</h2>
          <p className="mt-1 mb-0 text-sm text-muted-foreground">
            Compare expenses by month, 3 months, 6 months or year. Click a bar to see that period in detail.
          </p>
        </div>
        <div role="tablist" aria-label="Period" className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
          {(Object.keys(PERIODS) as Period[]).map((key) => {
            const on = key === period
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setPeriod(key)
                  setPicked(null)
                }}
                className={cn(tabClass, on ? "bg-primary text-primary-foreground" : "bg-transparent text-ink-2 hover:bg-accent")}
              >
                {PERIODS[key].label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-2xl border bg-card p-[18px]">
            <Eyebrow>{k.label}</Eyebrow>
            <div className="font-display text-[26px] font-bold" style={k.color ? { color: k.color } : undefined}>
              {k.value}
            </div>
            <div className="text-[13px] text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      <Card className="gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Expenses per {PERIODS[period].noun}</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
            {CATEGORIES.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5">
                <Swatch color={c.color} />
                {c.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex h-[280px] items-stretch gap-3 overflow-x-auto border-b pb-1">
          {shown.map((b) => {
            const g = groups[b], on = b === sel
            return (
              <button
                key={b}
                type="button"
                aria-pressed={on}
                aria-label={`${bucketLong(period, b)}: ${fmt(g.t.total)}`}
                onClick={() => setPicked(b)}
                className="flex max-w-24 flex-[1_0_48px] cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent p-0 outline-none focus-visible:outline-2 focus-visible:outline-ring"
                style={{ opacity: on ? 1 : 0.5 }}
              >
                <span className={cn("font-mono text-[11px] text-foreground", on && "font-bold")}>{cf(g.t.total)}</span>
                <div className="flex min-h-0 w-full flex-[1_1_0] flex-col-reverse overflow-hidden rounded-t-md">
                  {CATEGORIES.map((c) => (
                    <div key={c.key} className="w-full flex-none" style={{ height: `${(g.t[c.key] / maxB) * 100}%`, background: c.color }} />
                  ))}
                </div>
                <span className={cn("text-xs whitespace-nowrap text-foreground", on && "font-bold")}>{bucketShort(period, b)}</span>
              </button>
            )
          })}
        </div>
        <p className="m-0 text-[13px] text-muted-foreground">{chartNote}</p>
      </Card>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[999_1_520px] gap-3 p-6">
          <CardTitle className="text-lg">Breakdown · {bucketLong(period, sel)}</CardTitle>
          <div className="overflow-x-auto">
            <div className="flex min-w-[520px] flex-col">
              <div className={cn(tableGrid, "border-b py-2 text-xs uppercase tracking-[0.06em] text-muted-foreground")}>
                <span>Category</span>
                <span className="text-right">Total</span>
                <span className="text-right">Share</span>
                <span className="text-right">Per month</span>
                <span className="text-right">vs previous</span>
              </div>
              {CATEGORIES.map((c) => {
                const cc = change(!!pg, sg.t[c.key] / nM, pg ? pg.t[c.key] / pg.months.length : 0)
                return (
                  <div key={c.key} className={cn(tableGrid, "items-center border-b border-line py-2.5 text-sm")}>
                    <span className="flex items-center gap-2">
                      <Swatch color={c.color} />
                      {c.label}
                    </span>
                    <span className="text-right font-mono">{fmt(sg.t[c.key])}</span>
                    <span className="text-right font-mono text-muted-foreground">{share(sg.t[c.key])}%</span>
                    <span className="text-right font-mono">{fmt(sg.t[c.key] / nM)}</span>
                    <span className="text-right font-mono" style={{ color: cc.color }}>{cc.text}</span>
                  </div>
                )
              })}
              <div className={cn(tableGrid, "items-center pt-3 text-sm font-semibold")}>
                <span>Total</span>
                <span className="text-right font-mono">{fmt(sg.t.total)}</span>
                <span className="text-right font-mono text-muted-foreground">100%</span>
                <span className="text-right font-mono">{fmt(sAvg)}</span>
                <span className="text-right font-mono" style={{ color: totChg.color }}>{totChg.text}</span>
              </div>
            </div>
          </div>
          <p className="m-0 text-[13px] text-muted-foreground">
            &quot;vs previous&quot; compares the average per month with {prevB ? bucketShort(period, prevB) : "the previous period"}, so periods with missing months stay comparable.
          </p>
        </Card>

        <Card className="flex-[1_1_320px] gap-3 p-6">
          <CardTitle className="text-lg">Months in this period</CardTitle>
          {sg.months.map((x) => (
            <div key={x.key} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className={x.key === month ? "font-bold" : undefined}>{monthLabel(x.key)}</span>
                <span className="font-mono">{fmt(x.total)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-track">
                <div className="h-2 rounded bg-brand" style={{ width: `${(x.total / maxMo) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="m-0 text-[13px] text-muted-foreground">{monthsNote}</p>
        </Card>
      </div>
    </section>
  )
}
