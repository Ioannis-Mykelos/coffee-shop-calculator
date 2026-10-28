import { Card, CardTitle, Swatch } from "@/components/ui/card"
import { Field, NumberInput } from "@/components/ui/input"
import {
  CATEGORIES,
  type Currency,
  type MonthData,
  type MonthsData,
  type Totals,
  breakEven,
  compactFormatter,
  computeTotals,
  monthName,
  monthShort,
  priceFormatter,
  shiftMonth,
} from "@/lib/expenses"

type Fmt = (n: number) => string

export function TotalCard({ data, month, totals, fmt, monthLabel }: { data: MonthsData; month: string; totals: Totals; fmt: Fmt; monthLabel: string }) {
  const prevK = shiftMonth(month, -1)
  const prevName = monthName(prevK, { month: "long" })
  let text = `No figures for ${prevName} yet`
  let dir: "up" | "down" | null = null
  if (data[prevK]) {
    const p = computeTotals(data[prevK]).total
    const d = totals.total - p
    const pc = p > 0 ? Math.abs((d / p) * 100).toFixed(1) + "%" : ""
    if (Math.round(d) === 0) text = `Same as ${prevName}`
    else {
      text = `${fmt(Math.abs(d))}${pc ? ` (${pc})` : ""} ${d > 0 ? "more" : "less"} than ${prevName}`
      dir = d > 0 ? "up" : "down"
    }
  }
  return (
    <section className="flex flex-col gap-1.5 rounded-2xl bg-primary p-6 text-primary-foreground">
      <div className="text-xs uppercase tracking-[0.08em] text-[#D9C9B6]">Estimated expenses · {monthLabel}</div>
      <div className="font-display text-[40px] font-bold tracking-[-0.02em]">{fmt(totals.total)}</div>
      <div className={`text-sm ${dir === "up" ? "text-[#F4B7A8]" : dir === "down" ? "text-[#A6DCC9]" : "text-[#D9C9B6]"}`}>
        {dir === "up" && "▲ "}
        {dir === "down" && "▼ "}
        {text}
      </div>
    </section>
  )
}

export function BreakdownCard({ totals, fmt }: { totals: Totals; fmt: Fmt }) {
  const cats = CATEGORIES.map((c) => ({ ...c, pct: totals.total > 0 ? (totals[c.key] / totals.total) * 100 : 0 }))
  return (
    <Card>
      <CardTitle>Where the money goes</CardTitle>
      <div className="flex h-3.5 overflow-hidden rounded-[7px] bg-track">
        {cats.map((c) => (
          <div key={c.key} className="h-3.5" style={{ width: `${c.pct}%`, background: c.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {cats.map((c) => (
          <div key={c.key} className="flex items-center gap-2.5 text-sm">
            <Swatch color={c.color} />
            <span className="flex-1">{c.label}</span>
            <span className="font-mono text-[13px] text-muted-foreground">{Math.round(c.pct)}%</span>
            <span className="min-w-24 text-right font-mono">{fmt(totals[c.key])}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

const pctLabel = (v: number) => (v * 100).toFixed(1).replace(/\.0$/, "").replace(".", ",") + "%"

export function BreakEvenCard({ month, total, fmt, currency, mutate }: { month: MonthData; total: number; fmt: Fmt; currency: Currency; mutate: (fn: (m: MonthData) => void) => void }) {
  const be = breakEven(month, total)
  const price = priceFormatter(currency)
  const symbol = price(0).replace(/[\d\s.,\u00a0]/g, "") || currency
  return (
    <Card>
      <CardTitle>Break-even check</CardTitle>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-end gap-3">
        <Field label="Opening days">
          <NumberInput
            inputMode="numeric"
            maxLength={2}
            value={month.days}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "")
              const v = d && Math.min(+d, 31).toString()
              mutate((m) => void (m.days = v))
            }}
          />
        </Field>
        <Field label="Avg. coffees per customer">
          <NumberInput
            value={month.coffeesPerCustomer}
            onChange={(e) => {
              const v = e.target.value
              mutate((m) => void (m.coffeesPerCustomer = v))
            }}
          />
        </Field>
      </div>
      <div className="flex justify-between gap-3 text-sm">
        <span>
          Coffee spend per customer
          <span className="block text-[13px] text-muted-foreground">
            {be.coffees.toLocaleString("en-GB")} × {price(be.cupPrice)} (price for the customer, incl. VAT)
          </span>
        </span>
        <strong className="font-mono font-medium">{price(be.coffeeSpend)}</strong>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle p-3">
        <div className="text-sm font-semibold">Other consumables</div>
        <Field label={`Juice, pastries etc. per customer, incl. VAT (${symbol})`}>
          <NumberInput
            value={month.extrasPerCustomer}
            onChange={(e) => {
              const v = e.target.value
              mutate((m) => void (m.extrasPerCustomer = v))
            }}
          />
        </Field>
        <span className="text-[13px] text-muted-foreground">VAT {pctLabel(be.extrasVat)}, set under Consumables pricing.</span>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <span>Avg. sale per customer, incl. VAT</span>
          <strong className="font-mono font-medium">{price(be.avgGross)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Other consumables per customer</span>
          <strong className="font-mono font-medium">{price(be.extras)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Cost per opening day</span>
          <strong className="font-mono font-medium">{fmt(be.perDay)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Customers needed this month</span>
          <strong className="font-mono font-medium">{be.customersMonth.toLocaleString("en-GB")}</strong>
        </div>
        <div className="mt-1 flex justify-between rounded-[10px] bg-brand-soft px-3 py-2.5 text-brand-strong">
          <span className="font-semibold">Customers needed per day</span>
          <strong className="font-mono font-medium">{be.customersDay.toLocaleString("en-GB")}</strong>
        </div>
      </div>
    </Card>
  )
}

/** Line chart of up to six months ending at the selected month. */
export function HistoryCard({ data, month, fmt, currency }: { data: MonthsData; month: string; fmt: Fmt; currency: Currency }) {
  const keys = Object.keys(data).filter((k) => k <= month).sort().slice(-6)
  const vals = keys.map((k) => computeTotals(data[k]).total)
  const hiV = Math.max(...vals), loV = Math.min(...vals)
  const span = hiV - loV || Math.max(hiV * 0.1, 1)
  const topV = hiV + span * 0.35, botV = Math.max(0, loV - span * 0.35)
  const cf = compactFormatter(currency)
  const n = keys.length
  const points = keys.map((k, i) => {
    const on = k === month
    return {
      key: k,
      on,
      x: n > 1 ? 4 + (i / (n - 1)) * 92 : 50,
      y: 100 - ((vals[i] - botV) / (topV - botV || 1)) * 100,
      label: monthShort(k),
      short: cf(vals[i]),
    }
  })
  const line = points.map((p) => `${p.x},${p.y}`).join(" ")
  const area = n > 1 ? `${line} ${points[n - 1].x},100 ${points[0].x},100` : ""
  const ariaLabel =
    "Monthly totals: " + keys.map((k, i) => `${monthName(k, { month: "short", year: "numeric" })} ${fmt(vals[i])}`).join(", ")

  return (
    <Card>
      <CardTitle>Last months</CardTitle>
      <div role="img" aria-label={ariaLabel} className="relative mx-2.5 h-[210px]">
        <div className="absolute inset-x-0 top-7 bottom-[34px]">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t" />
          <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute top-0 left-0 overflow-visible">
            {area && <polygon points={area} fill="var(--brand)" fillOpacity={0.1} />}
            <polyline points={line} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((p) => (
            <div key={p.key}>
              <div className="absolute size-0" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <div
                  className="absolute -top-1.5 -left-1.5 size-3 rounded-full border-[2.5px] border-brand"
                  style={{ background: p.on ? "var(--brand)" : "#FFFFFF" }}
                />
                <span className={`absolute bottom-2.5 left-0 -translate-x-1/2 font-mono text-[11px] whitespace-nowrap ${p.on ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {p.short}
                </span>
              </div>
              <div
                className={`absolute top-[calc(100%+10px)] -translate-x-1/2 text-xs whitespace-nowrap ${p.on ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                style={{ left: `${p.x}%` }}
              >
                {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
