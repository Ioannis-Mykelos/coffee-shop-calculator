import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Field, NumberInput } from "@/components/ui/input"
import { type MonthData, cupCost, num, profitOf, uid } from "@/lib/expenses"
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

/** Cost of one cup: recipe ingredients from Supplies plus a share of all other costs, and a suggested price. */
export function CupCostCard({ month, total, fmt, price, mutate }: { month: MonthData; total: number; fmt: Fmt; price: Fmt; mutate: Mutate }) {
  const c = cupCost(month, total)
  const usable = month.supplies.filter((s) => s.label.trim())
  const setRecipe = (id: string, field: "supplyId" | "qty", v: string) =>
    mutate((m) => {
      const r = m.cup.recipe.find((x) => x.id === id)
      if (r) r[field] = v
    })

  return (
    <Card className="gap-4 p-7">
      <div>
        <h2 className="m-0 font-display text-[22px] font-bold">Cost per cup</h2>
        <p className="mt-1 mb-0 text-sm text-muted-foreground">
          What goes into one coffee, priced from your Supplies, plus its share of rent, staff and everything else.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {c.lines.map((r) => (
          <div key={r.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-subtle p-3">
            <Field label="Ingredient" className="flex-[1_1_200px]">
              <select
                value={r.supply ? r.supplyId : ""}
                onChange={(e) => setRecipe(r.id, "supplyId", e.target.value)}
                className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <option value="" disabled>
                  Pick a supply item
                </option>
                {usable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Per cup${r.supply?.unit ? ` (${r.supply.unit})` : ""}`} className="flex-[0_1_120px]">
              <NumberInput className="px-2.5" value={r.qty} onChange={(e) => setRecipe(r.id, "qty", e.target.value)} />
            </Field>
            <div className="flex flex-[0_1_110px] flex-col gap-1 text-xs text-muted-foreground">
              Cost per cup
              <div className="flex h-11 items-center justify-end font-mono text-[15px] font-medium text-foreground">{price(r.cost)}</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label={`Remove ${r.supply?.label ?? "ingredient"}`}
              onClick={() => mutate((m) => void (m.cup.recipe = m.cup.recipe.filter((x) => x.id !== r.id)))}
              className="text-muted-foreground"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="dashed"
          className="self-start px-[18px]"
          onClick={() => mutate((m) => void m.cup.recipe.push({ id: uid(), supplyId: "", qty: "" }))}
        >
          + Add ingredient
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Field label="Cups sold this month">
          <NumberInput
            inputMode="numeric"
            value={month.cup.cups}
            onChange={(e) => {
              const v = e.target.value
              mutate((m) => void (m.cup.cups = v))
            }}
          />
        </Field>
        <Field label="Target profit margin (%)">
          <NumberInput
            value={month.cup.margin}
            onChange={(e) => {
              const v = e.target.value
              mutate((m) => void (m.cup.margin = v))
            }}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
        <Row label="Ingredients" value={price(c.ingredients)} />
        <Row
          label="Share of rent, staff and other costs"
          value={c.cups > 0 ? price(c.overhead) : "—"}
        />
        <Row label="Full cost of one cup" value={c.cups > 0 ? price(c.full) : "—"} className="font-semibold" />
        <div className="mt-1 flex justify-between rounded-[10px] bg-brand-soft px-3 py-2.5 text-brand-strong">
          <span className="font-semibold">Suggested price, excl. VAT ({Math.round(c.margin * 100)}% margin)</span>
          <strong className="font-mono font-medium">{c.cups > 0 ? price(c.price) : "—"}</strong>
        </div>
        <p className="m-0 mt-1 text-[13px] text-muted-foreground">
          {c.cups <= 0
            ? "Enter the cups sold this month to share the other costs across them."
            : c.earnedPerCup > 0
              ? `You took ${price(c.earnedPerCup)} per cup on average this month (${fmt(num(month.revenue))} over ${c.cups.toLocaleString("en-GB")} cups).`
              : "Enter this month's sales under Sales & profit to compare with what you earn per cup."}
        </p>
      </div>
    </Card>
  )
}
