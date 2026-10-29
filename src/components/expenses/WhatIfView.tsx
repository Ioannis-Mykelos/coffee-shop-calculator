"use client"

import { useState } from "react"

import { Card, CardTitle, Eyebrow } from "@/components/ui/card"
import { type MonthData, computeTotals } from "@/lib/expenses"
import { type Changes, NO_CHANGES, isBeans, isMilk, whatIf } from "@/lib/what-if"
import { cn } from "@/lib/utils"

type Fmt = (n: number) => string

const signed = (n: number) => (n > 0 ? "+" : "") + n + "%"

const PRESETS: { label: string; changes: Partial<Changes>; needs?: "beans" | "staff" }[] = [
  { label: "Beans up 15%", changes: { beans: 15 }, needs: "beans" },
  { label: "Rent up 10%", changes: { rent: 10 } },
  { label: "Hire a part-timer (20 h a week)", changes: { hours: 20 }, needs: "staff" },
  { label: "Quiet month (−20% sales)", changes: { sales: -20 } },
  { label: "Prices up 5%", changes: { price: 5 } },
]

/** "What if": try a change on the month's figures, see profit, costs and break-even move. Nothing is saved. */
export function WhatIfView({ month, fmt, price }: { month: MonthData; fmt: Fmt; price: Fmt }) {
  const [c, setC] = useState<Changes>(NO_CHANGES)
  const r = whatIf(month, c)
  const t = computeTotals(month)
  const hasBeans = month.supplies.some((s) => isBeans(s.label) && s.price.trim())
  const hasMilk = month.supplies.some((s) => isMilk(s.label) && s.price.trim())
  const set = (k: keyof Changes) => (e: React.ChangeEvent<HTMLInputElement>) => setC((x) => ({ ...x, [k]: Number(e.target.value) }))
  const changed = Object.values(c).some((v) => v !== 0)

  const sliders: { key: keyof Changes; label: string; min: number; max: number; step: number; value: string; hint: string; show: boolean }[] = [
    { key: "beans", label: "Coffee bean price", min: -20, max: 50, step: 5, value: signed(c.beans), hint: "Changes the beans on your Supplies", show: hasBeans },
    { key: "milk", label: "Milk price", min: -20, max: 50, step: 5, value: signed(c.milk), hint: "Changes every milk on your Supplies", show: hasMilk },
    { key: "rent", label: "Rent & premises", min: -30, max: 50, step: 5, value: signed(c.rent), hint: `Today ${fmt(t.premises)} a month`, show: t.premises > 0 },
    {
      key: "hours",
      label: "Extra staff hours",
      min: 0,
      max: 60,
      step: 5,
      value: `+${c.hours} h a week`,
      hint: `At ${price(r.hourly)} an hour with contributions, your staff's average`,
      show: r.hourly > 0,
    },
    {
      key: "price",
      label: "Price of every drink",
      min: -15,
      max: 20,
      step: 1,
      value: signed(c.price),
      hint: r.cupPrice > 0 ? `About ${c.price >= 0 ? "+" : "−"}${price(Math.abs((r.cupPrice * c.price) / 100))} on an average ${price(r.cupPrice)} drink` : "Set drink prices on the Menu view",
      show: true,
    },
    { key: "sales", label: "Cups sold", min: -40, max: 40, step: 5, value: signed(c.sales), hint: "Supplies and consumables move with it", show: true },
  ]

  const known = r.after.profit !== null && r.before.profit !== null
  const results = [
    ...(known ? [{ label: "Profit a month", before: r.before.profit!, after: r.after.profit!, show: fmt, higherIsGood: true }] : []),
    { label: "Costs a month", before: r.before.costs, after: r.after.costs, show: fmt, higherIsGood: false },
    ...(known ? [{ label: "Sales a month, excl. VAT", before: r.before.sales!, after: r.after.sales!, show: fmt, higherIsGood: true }] : []),
    { label: "Customers a day to break even", before: r.before.customersDay, after: r.after.customersDay, show: (n: number) => n.toLocaleString("en-GB"), higherIsGood: false },
  ]

  const parts = [
    { label: "Staff", value: r.after.parts.staff, color: "var(--chart-4)" },
    { label: "Rent & premises", value: r.after.parts.premises, color: "var(--chart-1)" },
    { label: "Supplies & consumables", value: r.after.parts.ingredients, color: "var(--chart-3)" },
    { label: "Utilities & other", value: r.after.parts.running, color: "var(--chart-5)" },
  ]
  const biggest = Math.max(...parts.map((p) => p.value), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2.5" aria-label="Quick scenarios" role="group">
        {PRESETS.filter((p) => (p.needs === "beans" ? hasBeans : p.needs === "staff" ? r.hourly > 0 : true)).map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setC({ ...NO_CHANGES, ...p.changes })}
            className="min-h-11 cursor-pointer rounded-full border border-input bg-card px-4 text-sm font-medium outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {p.label}
          </button>
        ))}
        {changed && (
          <button
            type="button"
            onClick={() => setC(NO_CHANGES)}
            className="min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-brand outline-none hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[1_1_340px] gap-5 p-6">
          <CardTitle>Change something</CardTitle>
          {sliders
            .filter((s) => s.show)
            .map((s) => (
              <div key={s.key} className="flex flex-col gap-1">
                <div className="flex justify-between gap-3 text-sm">
                  <label htmlFor={`whatif-${s.key}`} className="font-medium">
                    {s.label}
                  </label>
                  <span className={cn("font-mono font-semibold", c[s.key] === 0 ? "text-muted-foreground" : "text-brand")}>{s.value}</span>
                </div>
                <input
                  id={`whatif-${s.key}`}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={c[s.key]}
                  onChange={set(s.key)}
                  className="h-7 w-full cursor-pointer accent-brand"
                />
                <span className="text-xs text-muted-foreground">{s.hint}</span>
              </div>
            ))}
          <p className="m-0 text-xs text-muted-foreground">Nothing here changes your saved figures.</p>
        </Card>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {results.map((x) => {
              const d = x.after - x.before
              const same = Math.abs(d) < 0.5
              const good = (d > 0) === x.higherIsGood
              return (
                <Card key={x.label} className="gap-1.5">
                  <Eyebrow>{x.label}</Eyebrow>
                  <div className="font-display text-[26px] font-semibold">{x.show(x.after)}</div>
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="text-muted-foreground">was {x.show(x.before)}</span>
                    {!same && (
                      <span className={cn("rounded-full px-2.5 py-0.5 font-mono font-semibold", good ? "bg-[#E3F4EF] text-good" : "bg-[#FDEEF1] text-destructive")}>
                        {d > 0 ? "+" : "−"}
                        {x.show(Math.abs(d))}
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          <Advice r={r} c={c} fmt={fmt} price={price} onPrice={(p) => setC((x) => ({ ...x, price: Math.min(20, x.price + p) }))} />

          <Card className="gap-3">
            <Eyebrow>Where the money goes, a month</Eyebrow>
            {parts.map((p) => (
              <div key={p.label} className="grid grid-cols-[minmax(120px,1fr)_minmax(0,2fr)_minmax(80px,auto)] items-center gap-3 text-sm">
                <span>{p.label}</span>
                <span className="block h-2.5 rounded-full bg-track">
                  <span
                    className="block h-2.5 rounded-full"
                    style={{ background: p.color, width: `${biggest > 0 ? Math.max(2, Math.round((p.value / biggest) * 100)) : 0}%` }}
                  />
                </span>
                <span className="text-right font-mono">{fmt(p.value)}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

/** The headline: what the change costs or earns a month, and what would keep today's profit. */
function Advice({
  r,
  c,
  fmt,
  price,
  onPrice,
}: {
  r: ReturnType<typeof whatIf>
  c: Changes
  fmt: Fmt
  price: Fmt
  onPrice: (pct: number) => void
}) {
  const box = "flex flex-col gap-1.5 rounded-2xl p-5"
  if (r.salesSource === null) {
    return (
      <div className={cn(box, "border bg-card")}>
        <span className="font-display text-lg font-semibold">See the effect on profit</span>
        <span className="text-[15px] text-muted-foreground">
          Type in this month&apos;s takings (Sales &amp; profit, on Expenses), or about how many of each drink you sell (on the Menu).
        </span>
      </div>
    )
  }
  const source = r.salesSource === "takings" ? "this month's takings" : "the cups sold on your menu"
  if (r.keep && r.before.profit !== null) {
    const { pricePct, customersDay } = r.keep
    return (
      <div className={cn(box, "bg-[#FDEEF1] text-[#5c1f30]")}>
        <span className="font-display text-lg font-semibold">This costs you {fmt(r.gap)} a month</span>
        <span className="text-[15px] leading-relaxed">
          To keep today&apos;s profit of {fmt(r.before.profit)}
          {pricePct !== null && <>, raise drink prices by about {pricePct}% (about {price((r.cupPrice * pricePct) / 100)} on an average drink)</>}
          {customersDay !== null && <>{pricePct !== null ? ", or win" : ", win"} about {customersDay} more customers a day</>}.
        </span>
        {pricePct !== null && c.price + pricePct <= 20 && (
          <button
            type="button"
            onClick={() => onPrice(pricePct)}
            className="mt-1 min-h-11 w-fit cursor-pointer rounded-full bg-espresso px-[18px] text-sm font-semibold text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Try prices +{pricePct}%
          </button>
        )}
        <span className="text-xs opacity-80">Worked out from {source}.</span>
      </div>
    )
  }
  if (r.gap < -0.5) {
    return (
      <div className={cn(box, "bg-[#E3F4EF] text-[#0f4f45]")}>
        <span className="font-display text-lg font-semibold">You&apos;d earn {fmt(-r.gap)} more a month</span>
        <span className="text-xs opacity-80">Worked out from {source}.</span>
      </div>
    )
  }
  return (
    <div className={cn(box, "border bg-card")}>
      <span className="font-display text-lg font-semibold">Move a slider, or pick a scenario above</span>
      {r.before.profit !== null && (
        <span className="text-[15px] text-muted-foreground">
          {r.before.profit >= 0 ? `Today you make ${fmt(r.before.profit)} a month` : `Today you lose ${fmt(-r.before.profit)} a month`}, going by {source}.
        </span>
      )}
    </div>
  )
}
