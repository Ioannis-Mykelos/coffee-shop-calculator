import { Card, CardTitle } from "@/components/ui/card"
import { Field, NumberInput } from "@/components/ui/input"
import { type MonthData, consumablePrices, profitOf } from "@/lib/expenses"
import { cn } from "@/lib/utils"

type Mutate = (fn: (m: MonthData) => void) => void
type Fmt = (n: number) => string

const pct = (v: number) => (v * 100).toFixed(1).replace(".", ",") + "%"

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-3", className)}>
      <span>{label}</span>
      <strong className="font-mono font-medium">{value}</strong>
    </div>
  )
}

/** Actual sales for the month, and the profit or loss they leave after all costs. */
export function ProfitCard({ month, total, fmt, mutate }: { month: MonthData; total: number; fmt: Fmt; mutate: Mutate }) {
  const p = profitOf(month, total)
  const loss = p ? p.profit < 0 : false
  return (
    <Card>
      <CardTitle>Sales &amp; profit</CardTitle>
      <Field label="Actual sales this month, excl. VAT">
        <NumberInput
          value={month.revenue}
          placeholder="Enter takings"
          onChange={(e) => {
            const v = e.target.value
            mutate((m) => void (m.revenue = v))
          }}
        />
      </Field>
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
          Type in what the shop actually took this month to see the profit or loss and how far you are from break-even.
        </p>
      )}
    </Card>
  )
}

const tableGrid = "grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-3"

/** Selling price of each item from the Consumables tab: cost + margin, then VAT. */
export function ConsumablePricingCard({ month, price, mutate }: { month: MonthData; price: Fmt; mutate: Mutate }) {
  const c = consumablePrices(month)
  const setP = (field: "margin" | "vat") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    mutate((m) => void (m.consumablePricing[field] = v))
  }
  return (
    <Card className="gap-4 p-7">
      <div>
        <h2 className="m-0 font-display text-[22px] font-bold">Consumables pricing</h2>
        <p className="mt-1 mb-0 text-sm text-muted-foreground">
          Selling price of each item on the Consumables tab: what it costs you, plus your margin, plus VAT.
        </p>
      </div>

      <div className="grid max-w-[480px] grid-cols-2 gap-3">
        <Field label="Margin on cost (%)">
          <NumberInput value={month.consumablePricing.margin} onChange={setP("margin")} />
        </Field>
        <Field label="VAT (%)">
          <NumberInput value={month.consumablePricing.vat} placeholder="e.g. 25" onChange={setP("vat")} />
        </Field>
      </div>

      {c.items.length ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[480px] flex-col text-sm">
            <div className={cn(tableGrid, "border-b py-2 text-xs uppercase tracking-[0.06em] text-muted-foreground")}>
              <span>Item</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Excl. VAT</span>
              <span className="text-right">VAT</span>
              <span className="text-right">Customer price</span>
            </div>
            {c.items.map((x) => (
              <div key={x.id} className={cn(tableGrid, "items-center border-b border-line py-2.5")}>
                <span className="truncate">
                  {x.label}
                  {x.unit && <span className="text-muted-foreground"> / {x.unit}</span>}
                </span>
                <span className="text-right font-mono">{price(x.cost)}</span>
                <span className="text-right font-mono">{price(x.price)}</span>
                <span className="text-right font-mono text-muted-foreground">{price(x.vatAmount)}</span>
                <span className="text-right font-mono font-semibold text-brand-strong">{price(x.priceInclVat)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="m-0 text-[13px] text-muted-foreground">Add items on the Consumables tab to price them here.</p>
      )}
    </Card>
  )
}
