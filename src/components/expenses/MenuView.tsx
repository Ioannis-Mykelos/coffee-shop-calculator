"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { ConsumablePricingCard, ProfitCard } from "@/components/expenses/ProfitCards"
import { BreakEvenCard } from "@/components/expenses/Sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardTitle, Eyebrow } from "@/components/ui/card"
import { Field, Input, NumberInput } from "@/components/ui/input"
import { type Currency, type Drink, type MonthData, num, uid } from "@/lib/expenses"
import { type DrinkFigures, menuRates, menuSummary, plantMilkReady } from "@/lib/menu"
import { cn } from "@/lib/utils"

type Mutate = (fn: (m: MonthData) => void) => void
type Fmt = (n: number) => string

const pct = (v: number) => Math.round(v * 100) + "%"
const selectClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
const COLUMNS = "grid grid-cols-[minmax(150px,1.6fr)_repeat(4,minmax(72px,1fr))_minmax(160px,1.6fr)] gap-3"

/**
 * Menu & sales: each drink's recipe priced from Supplies, what it earns per cup and per month, best earners first
 * (picking a drink opens it to edit); then the month's sales and profit, the break-even (at the menu's average drink
 * price), and the prices of the consumables sold.
 */
export function MenuView({
  month,
  total,
  currency,
  mutate,
  fmt,
  price,
}: {
  month: MonthData
  /** The month's costs */
  total: number
  currency: Currency
  mutate: Mutate
  fmt: Fmt
  price: Fmt
}) {
  const [plant, setPlant] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const plantReady = plantMilkReady(month)
  const s = menuSummary(month, plant && plantReady)
  const selected = s.drinks.find((d) => d.id === picked) ?? s.drinks[0] ?? null

  const addDrink = () => {
    const id = uid()
    mutate((m) => void m.menu.drinks.push({ id, name: "", price: "", vat: "", cups: "", recipe: [] }))
    setPicked(id)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[620px] text-sm text-muted-foreground">
          Each drink&apos;s recipe is priced from your Supplies. Margin is the menu price without VAT, minus what the drink costs to make.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {plantReady && (
            <Button variant="outline" aria-pressed={plant} onClick={() => setPlant((p) => !p)} className={cn(plant && "border-brand bg-brand-soft text-brand-ink")}>
              {plant ? "Showing plant milk prices" : "Show plant milk prices"}
            </Button>
          )}
          <Button onClick={addDrink}>
            <Plus />
            Add a drink
          </Button>
        </div>
      </div>

      {s.drinks.length === 0 ? (
        <Card className="items-start p-7">
          <CardTitle>No drinks yet</CardTitle>
          <p className="m-0 text-sm text-muted-foreground">
            Add the drinks you sell, with what goes into each from your Supplies, to see which ones earn you the most.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <Card className="gap-1">
              <Eyebrow>{s.withCups ? "Earns you the most a month" : "Biggest margin per cup"}</Eyebrow>
              <div className="font-display text-xl font-semibold">{s.best?.name ?? "—"}</div>
              {s.best && (
                <div className="font-mono text-sm text-good">{s.withCups ? fmt(s.best.monthly) + " a month" : price(s.best.margin) + " a cup"}</div>
              )}
            </Card>
            <Card className="gap-1">
              <Eyebrow>Thinnest margin per cup</Eyebrow>
              <div className="font-display text-xl font-semibold">{s.thinnest?.name ?? "—"}</div>
              {s.thinnest && (
                <div className={cn("font-mono text-sm", s.thinnest.margin < 0 ? "text-destructive" : "text-ink-2")}>
                  {price(s.thinnest.margin)} a cup ({pct(s.thinnest.marginPct)})
                </div>
              )}
            </Card>
            <Card className="gap-1">
              <Eyebrow>All drinks, a month</Eyebrow>
              {s.withCups ? (
                <>
                  <div className="font-display text-xl font-semibold">{fmt(s.profit)} kept</div>
                  <div className="font-mono text-sm text-muted-foreground">
                    {s.cups.toLocaleString("en-GB")} cups · {price(s.perCup)} a cup
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Type in about how many of each drink you sell a month to see this.</div>
              )}
            </Card>
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <section aria-label="Drinks, best earners first" className="min-w-0 flex-[3_1_560px] rounded-2xl border bg-card py-2">
              <div className="overflow-x-auto">
                <div className="flex min-w-[720px] flex-col">
                  <div className={cn(COLUMNS, "border-b border-line px-5 py-2.5 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase")}>
                    <span>Drink</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Margin</span>
                    <span className="text-right">Cups / mo</span>
                    <span>Kept / month</span>
                  </div>
                  {s.drinks.map((d) => (
                    <DrinkRow
                      key={d.id}
                      d={d}
                      on={d.id === selected?.id}
                      max={Math.max(...s.drinks.map((x) => x.monthly), 0)}
                      fmt={fmt}
                      price={price}
                      plantNote={plant && d.hasMilk ? `plant milk +${price(num(month.menu.plantMilk.surcharge))}` : ""}
                      onPick={() => setPicked(d.id)}
                    />
                  ))}
                </div>
              </div>
              <p className="m-0 px-5 pt-3 pb-2 text-[13px] text-muted-foreground">
                Prices include VAT, at each drink&apos;s rate; cost and margin don&apos;t. Pick a drink to change its recipe and price.
              </p>
            </section>

            {selected && (
              <DrinkEditor
                key={selected.id}
                month={month}
                d={selected}
                plant={plant && selected.hasMilk}
                mutate={mutate}
                price={price}
                onDelete={() => setPicked(null)}
              />
            )}
          </div>
        </>
      )}

      <section aria-labelledby="sales-heading" className="flex flex-col gap-4">
        <h2 id="sales-heading" className="m-0 font-display text-[22px] font-bold">
          Sales &amp; break-even
        </h2>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[1_1_340px] flex-col">
            <ProfitCard month={month} total={total} fmt={fmt} mutate={mutate} />
          </div>
          <div className="flex min-w-0 flex-[1_1_340px] flex-col">
            <BreakEvenCard month={month} total={total} fmt={fmt} currency={currency} mutate={mutate} />
          </div>
        </div>
        <ConsumablePricingCard month={month} price={price} mutate={mutate} />
      </section>

      <MenuSettingsCard month={month} mutate={mutate} />
    </div>
  )
}

function DrinkRow({
  d,
  on,
  max,
  fmt,
  price,
  plantNote,
  onPick,
}: {
  d: DrinkFigures
  on: boolean
  max: number
  fmt: Fmt
  price: Fmt
  plantNote: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={cn(
        COLUMNS,
        "min-h-[60px] w-full cursor-pointer items-center border-b border-line px-5 py-2.5 text-left text-sm outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        on ? "bg-brand-soft shadow-[inset_3px_0_0_var(--brand)]" : "bg-card hover:bg-subtle",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{d.name}</span>
        {plantNote && <span className="text-xs text-muted-foreground">{plantNote}</span>}
      </span>
      <span className="text-right font-mono">{price(d.cost)}</span>
      <span className="flex flex-col text-right font-mono">
        <span>{d.price > 0 ? price(d.price) : "—"}</span>
        <span className="text-xs text-muted-foreground">VAT {pct(d.vat)}</span>
      </span>
      <span className={cn("flex flex-col text-right font-mono", d.margin < 0 && "text-destructive")}>
        <span>{d.price > 0 ? price(d.margin) : "—"}</span>
        {d.price > 0 && <span className="text-xs text-muted-foreground">{pct(d.marginPct)}</span>}
      </span>
      <span className="text-right font-mono">{d.cups > 0 ? d.cups.toLocaleString("en-GB") : "—"}</span>
      <span className="flex flex-col gap-1.5">
        <span className="font-mono font-medium">{d.cups > 0 && d.price > 0 ? fmt(d.monthly) : "—"}</span>
        <span className="block h-2 rounded-full bg-track">
          <span
            className={cn("block h-2 rounded-full", on ? "bg-brand" : "bg-crema")}
            style={{ width: `${max > 0 && d.monthly > 0 ? Math.max(4, Math.round((d.monthly / max) * 100)) : 0}%` }}
          />
        </span>
      </span>
    </button>
  )
}

/** One drink: its name, price and cups sold, its recipe from Supplies, and what's left of each sale. */
function DrinkEditor({
  month,
  d,
  plant,
  mutate,
  price,
  onDelete,
}: {
  month: MonthData
  d: DrinkFigures
  plant: boolean
  mutate: Mutate
  price: Fmt
  onDelete: () => void
}) {
  const drink = month.menu.drinks.find((x) => x.id === d.id)
  if (!drink) return null
  const { target } = menuRates(month)
  const usable = month.supplies.filter((s) => s.label.trim())
  const set = (fn: (x: Drink) => void) =>
    mutate((m) => {
      const x = m.menu.drinks.find((y) => y.id === d.id)
      if (x) fn(x)
    })
  const diff = d.targetPrice - d.price

  return (
    <aside aria-label={`${d.name}: recipe and price`} className="flex min-w-0 flex-[2_1_400px] flex-col gap-4 rounded-2xl border bg-card p-5">
      <Field label="Drink">
        <Input value={drink.name} placeholder="e.g. Cappuccino" maxLength={120} onChange={(e) => set((x) => void (x.name = e.target.value))} />
      </Field>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3">
        <Field label="Menu price, incl. VAT">
          <NumberInput value={drink.price} onChange={(e) => set((x) => void (x.price = e.target.value))} />
        </Field>
        {/* Blank: the menu's VAT. Take-away and sit-in can be taxed differently, so each drink can set its own. */}
        <Field label="VAT (%)">
          <NumberInput value={drink.vat} placeholder={month.menu.vat || "0"} onChange={(e) => set((x) => void (x.vat = e.target.value))} />
        </Field>
        <Field label="Cups sold a month">
          <NumberInput value={drink.cups} placeholder="About how many?" onChange={(e) => set((x) => void (x.cups = e.target.value))} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow>Recipe, per cup{plant && " (with plant milk)"}</Eyebrow>
        {usable.length === 0 && <p className="m-0 text-sm text-muted-foreground">Add your supplies (beans, milk, cups…) on the Expenses view first.</p>}
        {drink.recipe.map((r, i) => {
          const line = d.lines[i]
          return (
            <div key={r.id} className="flex items-end gap-2 rounded-xl border border-line bg-subtle p-2.5">
              <Field label="Ingredient" className="flex-[1_1_140px]">
                <select
                  value={usable.some((s) => s.id === r.supplyId) ? r.supplyId : ""}
                  onChange={(e) => set((x) => void (x.recipe[i].supplyId = e.target.value))}
                  className={selectClass}
                >
                  <option value="" disabled>
                    Pick a supply
                  </option>
                  {usable.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Amount${line?.unit ? ` (${line.unit})` : ""}`} className="flex-[0_1_96px]">
                <NumberInput className="px-2.5" value={r.qty} onChange={(e) => set((x) => void (x.recipe[i].qty = e.target.value))} />
              </Field>
              <div className="flex h-11 w-16 shrink-0 items-center justify-end font-mono text-sm">{price(line?.cost ?? 0)}</div>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Remove ${line?.label ?? "ingredient"}`}
                onClick={() => set((x) => void x.recipe.splice(i, 1))}
                className="shrink-0 text-muted-foreground"
              >
                <Trash2 />
              </Button>
            </div>
          )
        })}
        <Button variant="dashed" className="self-start" onClick={() => set((x) => void x.recipe.push({ id: uid(), supplyId: "", qty: "" }))}>
          + Add ingredient
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle p-3.5 text-sm">
        <Line label={plant ? "Menu price, with plant milk" : "Menu price"} value={d.price > 0 ? price(d.price) : "—"} />
        <Line label={`VAT (${pct(d.vat)})`} value={"− " + price(d.price - d.net)} muted />
        <Line label="Cost to make" value={"− " + price(d.cost)} muted />
        <div className={cn("flex justify-between border-t border-line pt-2 font-semibold", d.margin < 0 ? "text-destructive" : "text-good")}>
          <span>{d.margin < 0 ? "You lose" : "You keep"}</span>
          <span className="font-mono">
            {price(Math.abs(d.margin))} {d.price > 0 && `(${pct(d.marginPct)})`}
          </span>
        </div>
      </div>

      {d.targetPrice > 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-brand-soft p-3.5 text-brand-ink">
          <span className="text-sm font-semibold">
            For a {pct(target)} margin, charge {price(d.targetPrice)}
          </span>
          <span className="text-[13px]">
            {Math.abs(diff) < 0.05
              ? "Your price is right on target."
              : diff > 0
                ? `${price(diff)} more than today.`
                : `You already charge ${price(-diff)} more than that.`}
          </span>
        </div>
      )}

      <Button
        variant="ghost"
        className="self-start text-destructive"
        onClick={() => {
          mutate((m) => void (m.menu.drinks = m.menu.drinks.filter((x) => x.id !== d.id)))
          onDelete()
        }}
      >
        <Trash2 />
        Remove {d.name} from the menu
      </Button>
    </aside>
  )
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

/** The VAT on drinks without their own, the margin suggested prices aim for, and the plant milk option. */
function MenuSettingsCard({ month, mutate }: { month: MonthData; mutate: Mutate }) {
  const usable = month.supplies.filter((s) => s.label.trim())
  const { plantMilk } = month.menu
  const setPlant = (k: keyof typeof plantMilk, v: string) => mutate((m) => void (m.menu.plantMilk[k] = v))
  return (
    <Card className="gap-4 p-6">
      <CardTitle>Menu settings</CardTitle>
      <div className="flex flex-wrap gap-4">
        <Field label="Default VAT on drinks (%)" className="flex-[0_1_200px]">
          <NumberInput value={month.menu.vat} onChange={(e) => mutate((m) => void (m.menu.vat = e.target.value))} />
        </Field>
        <Field label="Target margin (%)" className="flex-[0_1_160px]">
          <NumberInput value={month.menu.target} onChange={(e) => mutate((m) => void (m.menu.target = e.target.value))} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow>Plant milk option</Eyebrow>
        <p className="m-0 text-sm text-muted-foreground">
          Pick the milk it replaces and the plant milk from your Supplies to compare prices with it, extra charge included.
        </p>
        <div className="flex flex-wrap gap-4">
          {(["milkId", "plantId"] as const).map((k) => (
            <Field key={k} label={k === "milkId" ? "Replaces" : "Plant milk"} className="flex-[1_1_180px]">
              <select
                value={usable.some((s) => s.id === plantMilk[k]) ? plantMilk[k] : ""}
                onChange={(e) => setPlant(k, e.target.value)}
                className={selectClass}
              >
                <option value="">None</option>
                {usable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <Field label="Extra charge, incl. VAT" className="flex-[0_1_160px]">
            <NumberInput value={plantMilk.surcharge} onChange={(e) => setPlant("surcharge", e.target.value)} />
          </Field>
        </div>
      </div>
    </Card>
  )
}
