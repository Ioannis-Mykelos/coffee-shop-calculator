"use client"

import { useState } from "react"
import { Coffee, Croissant, Plus, Trash2 } from "lucide-react"

import { ProfitCard } from "@/components/expenses/ProfitCards"
import { BreakEvenCard } from "@/components/expenses/Sidebar"
import { Button } from "@/components/ui/button"
import { Card, Eyebrow } from "@/components/ui/card"
import { Field, Input, NumberInput } from "@/components/ui/input"
import { type Currency, type Drink, type MonthData, PLANT_MILK, drinkVat, num, uid } from "@/lib/expenses"
import { type DrinkFigures, menuRates, menuSummary, plantMilkReady } from "@/lib/menu"
import { cn } from "@/lib/utils"

type Mutate = (fn: (m: MonthData) => void) => void
type Fmt = (n: number) => string

const pct = (v: number) => Math.round(v * 100) + "%"
const selectClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
const COLUMNS = "grid grid-cols-[minmax(150px,1.6fr)_repeat(4,minmax(72px,1fr))_minmax(160px,1.6fr)] gap-3"

/**
 * Menu & sales: each drink's or food item's recipe priced from Supplies and Consumables, what it earns per sale and per
 * month, in a Drinks and a Food list, best earners first (picking one opens it to edit); then the month's sales and profit, the break-even (at the menu's average drink
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

  const add = (kind: Drink["kind"]) => {
    const id = uid()
    // Starts at the rate its kind had by default, written in so the owner sees and can change it.
    mutate((m) => {
      const vat = String(Math.round(drinkVat(m, { id, kind, name: "", price: "", vat: "", cups: "", recipe: [] }) * 10000) / 100)
      m.menu.drinks.push({ id, kind, name: "", price: "", vat, cups: "", recipe: [] })
    })
    setPicked(id)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[620px] text-sm text-muted-foreground">
          Each recipe is priced from your Supplies and Consumables. Margin is the menu price without VAT, minus what the item costs to make.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {plantReady && (
            <Button variant="outline" aria-pressed={plant} onClick={() => setPlant((p) => !p)} className={cn(plant && "border-brand bg-brand-soft text-brand-ink")}>
              {plant ? "Showing plant milk prices" : "Show plant milk prices"}
            </Button>
          )}
        </div>
      </div>

      {s.drinks.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <Card className="gap-1">
            <Eyebrow>{s.withCups ? "Earns you the most a month" : "Biggest margin per sale"}</Eyebrow>
            <div className="font-display text-xl font-semibold">{s.best?.name ?? "—"}</div>
            {s.best && (
              <div className="font-mono text-sm text-good">{s.withCups ? fmt(s.best.monthly) + " a month" : price(s.best.margin) + " each"}</div>
            )}
          </Card>
          <Card className="gap-1">
            <Eyebrow>Thinnest margin per sale</Eyebrow>
            <div className="font-display text-xl font-semibold">{s.thinnest?.name ?? "—"}</div>
            {s.thinnest && (
              <div className={cn("font-mono text-sm", s.thinnest.margin < 0 ? "text-destructive" : "text-ink-2")}>
                {price(s.thinnest.margin)} each ({pct(s.thinnest.marginPct)})
              </div>
            )}
          </Card>
          <Card className="gap-1">
            <Eyebrow>Whole menu, a month</Eyebrow>
            {s.withCups ? (
              <>
                <div className="font-display text-xl font-semibold">{fmt(s.profit)} kept</div>
                <div className="font-mono text-sm text-muted-foreground">
                  {s.cups.toLocaleString("en-GB")} sold · {price(s.perCup)} each
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Type in about how many of each item you sell a month to see this.</div>
            )}
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
          {(["drink", "food"] as const).map((kind) => (
            <MenuTable
              key={kind}
              kind={kind}
              items={s.drinks.filter((d) => d.kind === kind)}
              selected={selected?.id}
              fmt={fmt}
              price={price}
              plantNote={(d) => (plant && d.hasMilk ? `plant milk +${price(num(month.menu.plantMilk.surcharge))}` : "")}
              onPick={setPicked}
              onAdd={() => add(kind)}
            />
          ))}
          <p className="m-0 text-[13px] text-muted-foreground">
            Prices include VAT, at each item&apos;s rate; cost and margin don&apos;t. Pick an item to change its recipe and price.
          </p>
        </div>

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
      </section>

    </div>
  )
}

/** One part of the menu, drinks or food, best earners first, with its own button to add to it. */
function MenuTable({
  kind,
  items,
  selected,
  fmt,
  price,
  plantNote,
  onPick,
  onAdd,
}: {
  kind: Drink["kind"]
  items: DrinkFigures[]
  selected?: string
  fmt: Fmt
  price: Fmt
  plantNote: (d: DrinkFigures) => string
  onPick: (id: string) => void
  onAdd: () => void
}) {
  const food = kind === "food"
  const title = food ? "Food" : "Drinks"
  const max = Math.max(...items.map((x) => x.monthly), 0)
  return (
    <section aria-label={`${title}, best earners first`} className="min-w-0 rounded-2xl border bg-card py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-2 pb-3">
        <h3 className="m-0 flex items-center gap-2 font-display text-[17px] font-bold">
          {food ? <Croissant aria-hidden="true" className="size-[18px]" /> : <Coffee aria-hidden="true" className="size-[18px]" />}
          {title}
        </h3>
        <Button variant={food ? "outline" : "default"} onClick={onAdd}>
          <Plus />
          {food ? "Add food" : "Add a drink"}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="m-0 border-t border-line px-5 pt-3 pb-2 text-sm text-muted-foreground">
          {food
            ? "No food yet. Add what you sell to eat (croissants, sandwiches, cakes…) to see what each one earns."
            : "No drinks yet. Add what you sell to drink (coffees, teas, juices…) to see what each one earns."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[720px] flex-col">
            <div className={cn(COLUMNS, "border-y border-line px-5 py-2.5 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase")}>
              <span>{food ? "Food" : "Drink"}</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Price</span>
              <span className="text-right">Margin</span>
              <span className="text-right">{food ? "Sold / mo" : "Cups / mo"}</span>
              <span>Kept / month</span>
            </div>
            {items.map((d) => (
              <DrinkRow key={d.id} d={d} on={d.id === selected} max={max} fmt={fmt} price={price} plantNote={plantNote(d)} onPick={() => onPick(d.id)} />
            ))}
          </div>
        </div>
      )}
    </section>
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

/** One drink or food item: its name, price and number sold, its recipe from Supplies and Consumables, and what's left of each sale. */
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
  const food = d.kind === "food"
  // Food is made from what's bought in (Consumables); coffee, milk and cups aren't offered, except one already in the recipe.
  const supplies = month.supplies.filter((s) => s.label.trim() && (!food || drink.recipe.some((r) => r.supplyId === s.id)))
  const consumables = month.consumables.filter((s) => s.label.trim())
  const usable = [...supplies, ...consumables]
  const remove = () => {
    mutate((m) => void (m.menu.drinks = m.menu.drinks.filter((x) => x.id !== d.id)))
    onDelete()
  }
  const set = (fn: (x: Drink) => void) =>
    mutate((m) => {
      const x = m.menu.drinks.find((y) => y.id === d.id)
      if (x) fn(x)
    })
  const diff = d.targetPrice - d.price
  // The plant milk option, set up from any drink with milk in it: the milk it replaces is that drink's.
  const { plantMilk } = month.menu
  const milk = food
    ? undefined
    : month.supplies.find((s) => drink.recipe.some((r) => r.supplyId === s.id) && (s.id === plantMilk.milkId || (/milk/i.test(s.label) && !PLANT_MILK.test(s.label))))
  const setPlant = (k: "plantId" | "surcharge", v: string) =>
    mutate((m) => {
      m.menu.plantMilk[k] = v
      if (milk) m.menu.plantMilk.milkId = milk.id
    })

  return (
    <aside aria-label={`${d.name}: recipe and price`} className="flex min-w-0 flex-[2_1_400px] flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Added on the wrong list? Move it rather than starting again. */}
        <div role="group" aria-label="On the menu as" className="flex gap-1 rounded-xl border bg-subtle p-1">
          {(["drink", "food"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={d.kind === k}
              onClick={() => set((x) => void (x.kind = k))}
              className={cn(
                "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                d.kind === k ? "bg-primary text-primary-foreground" : "text-ink-2 hover:bg-accent",
              )}
            >
              {k === "food" ? <Croissant aria-hidden="true" className="size-4" /> : <Coffee aria-hidden="true" className="size-4" />}
              {k === "food" ? "Food" : "Drink"}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={remove} className="text-destructive">
          <Trash2 />
          Remove
        </Button>
      </div>
      <Field label={food ? "Food" : "Drink"}>
        <Input value={drink.name} placeholder={food ? "e.g. Croissant" : "e.g. Cappuccino"} maxLength={120} onChange={(e) => set((x) => void (x.name = e.target.value))} />
      </Field>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3">
        <Field label="Menu price, incl. VAT">
          <NumberInput value={drink.price} onChange={(e) => set((x) => void (x.price = e.target.value))} />
        </Field>
        {/* Blank: the menu's VAT for its kind. Take-away and sit-in can be taxed differently, so each item can set its own. */}
        <Field label="VAT (%)">
          <NumberInput value={drink.vat} placeholder={(food && month.menu.foodVat.trim()) || month.menu.vat || "0"} onChange={(e) => set((x) => void (x.vat = e.target.value))} />
        </Field>
        <Field label={food ? "Sold a month" : "Cups sold a month"}>
          <NumberInput value={drink.cups} placeholder="About how many?" onChange={(e) => set((x) => void (x.cups = e.target.value))} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow>
          Recipe, per {food ? "item" : "cup"}
          {plant && " (with plant milk)"}
        </Eyebrow>
        {usable.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground">
            {food
              ? "Add what goes into your food (pastries, bread, cheese…) under Consumables on the Expenses view first."
              : "Add your supplies (beans, milk, cups…) or consumables (juice…) on the Expenses view first."}
          </p>
        )}
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
                    Pick one
                  </option>
                  {(
                    [
                      ["Supplies", supplies],
                      ["Consumables", consumables],
                    ] as const
                  ).map(
                    ([group, items]) =>
                      items.length > 0 && (
                        <optgroup key={group} label={group}>
                          {items.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </optgroup>
                      ),
                  )}
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

      {milk && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3.5">
          <Eyebrow>Plant milk option</Eyebrow>
          <p className="m-0 text-[13px] text-muted-foreground">For every drink with {milk.label.trim()}: pick the plant milk that replaces it and what you charge extra.</p>
          <div className="flex flex-wrap gap-3">
            <Field label="Plant milk" className="flex-[1_1_160px]">
              <select
                value={month.supplies.some((s) => s.id === plantMilk.plantId) ? plantMilk.plantId : ""}
                onChange={(e) => setPlant("plantId", e.target.value)}
                className={selectClass}
              >
                <option value="">None</option>
                {month.supplies
                  .filter((s) => s.label.trim() && s.id !== milk.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Extra charge, incl. VAT" className="flex-[0_1_150px]">
              <NumberInput value={plantMilk.surcharge} onChange={(e) => setPlant("surcharge", e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {d.cost > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-brand-soft p-3.5 text-brand-ink">
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
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
          {/* One target for the whole menu */}
          <Field label="Target margin, all items (%)" className="flex-[0_0_150px] text-brand-ink">
            <NumberInput value={month.menu.target} onChange={(e) => mutate((m) => void (m.menu.target = e.target.value))} />
          </Field>
        </div>
      )}
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
