import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, Input, NumberInput } from "@/components/ui/input"
import {
  type LineCategoryKey,
  type MonthData,
  num,
  staffLine,
  staffSummary,
  uid,
} from "@/lib/expenses"
import { cn } from "@/lib/utils"

type Mutate = (fn: (m: MonthData) => void) => void
type Fmt = (n: number) => string

const rowClass = "flex flex-wrap items-end gap-3 rounded-xl border border-line bg-subtle p-3"

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="icon" aria-label={`Remove ${label}`} onClick={onClick} className="text-muted-foreground">
      <Trash2 />
    </Button>
  )
}

/** Update one field of one item in a list of the current month. */
function setField<K extends "premises" | "utilities" | "other" | "supplies" | "consumables" | "staff">(
  mutate: Mutate,
  list: K,
  id: string,
  field: string
) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    mutate((m) => {
      const it = (m[list] as { id: string }[]).find((x) => x.id === id) as Record<string, string> | undefined
      if (it) it[field] = v
    })
  }
}

function removeItem(mutate: Mutate, list: "premises" | "utilities" | "other" | "supplies" | "consumables" | "staff", id: string) {
  return () =>
    mutate((m) => {
      ;(m as unknown as Record<string, { id: string }[]>)[list] = m[list].filter((x) => x.id !== id)
    })
}

export function LineItemsEditor({ month, list, mutate }: { month: MonthData; list: LineCategoryKey; mutate: Mutate }) {
  return (
    <div className="flex flex-col gap-2.5">
      {month[list].map((it) => (
        <div key={it.id} className={rowClass}>
          <Field label="Expense" className="flex-[1_1_240px]">
            <Input value={it.label} onChange={setField(mutate, list, it.id, "label")} placeholder="e.g. Window cleaning" />
          </Field>
          <Field label="Amount per month" className="flex-[0_1_200px]">
            <NumberInput value={it.amount} onChange={setField(mutate, list, it.id, "amount")} />
          </Field>
          <RemoveButton label={it.label} onClick={removeItem(mutate, list, it.id)} />
        </div>
      ))}
      <Button
        variant="dashed"
        className="self-start px-[18px]"
        onClick={() => mutate((m) => void m[list].push({ id: uid(), label: "", amount: "" }))}
      >
        + Add expense
      </Button>
    </div>
  )
}

/** Quantity × price rows; used for Supplies and Consumables. */
export function SuppliesEditor({
  month,
  mutate,
  fmt,
  list = "supplies",
  placeholder = "e.g. Oat milk",
  addLabel = "+ Add supply",
}: {
  month: MonthData
  mutate: Mutate
  fmt: Fmt
  list?: "supplies" | "consumables"
  placeholder?: string
  addLabel?: string
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {month[list].map((it) => (
        <div key={it.id} className={rowClass}>
          <Field label="Item" className="flex-[1_1_200px]">
            <Input value={it.label} onChange={setField(mutate, list, it.id, "label")} placeholder={placeholder} />
          </Field>
          <Field label="Quantity" className="flex-[0_1_100px]">
            <NumberInput className="px-2.5" value={it.qty} onChange={setField(mutate, list, it.id, "qty")} />
          </Field>
          <Field label="Unit" className="flex-[0_1_80px]">
            <Input className="px-2.5" value={it.unit} onChange={setField(mutate, list, it.id, "unit")} placeholder="pcs" />
          </Field>
          <Field label="Price per unit" className="flex-[0_1_120px]">
            <NumberInput className="px-2.5" value={it.price} onChange={setField(mutate, list, it.id, "price")} />
          </Field>
          <div className="flex flex-[0_1_120px] flex-col gap-1 text-xs text-muted-foreground">
            Line total
            <div className="flex h-11 items-center justify-end font-mono text-[15px] font-medium text-foreground">
              {fmt(num(it.qty) * num(it.price))}
            </div>
          </div>
          <RemoveButton label={it.label} onClick={removeItem(mutate, list, it.id)} />
        </div>
      ))}
      <Button
        variant="dashed"
        className="self-start px-[18px]"
        onClick={() => mutate((m) => void m[list].push({ id: uid(), label: "", qty: "", unit: "pcs", price: "" }))}
      >
        {addLabel}
      </Button>
    </div>
  )
}

function StatTile({ label, value, className, labelClass, valueClass }: { label: string; value: number; className: string; labelClass: string; valueClass?: string }) {
  return (
    <div className={cn("rounded-xl p-3.5", className)}>
      <div className={cn("text-xs uppercase tracking-[0.06em]", labelClass)}>{label}</div>
      <div className={cn("font-display text-[28px] font-bold", valueClass)}>{value}</div>
    </div>
  )
}

const segBase =
  "min-h-10 cursor-pointer rounded-lg px-3.5 text-[13px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

export function StaffEditor({ month, mutate, fmt }: { month: MonthData; mutate: Mutate; fmt: Fmt }) {
  const { ft, pt, hours } = staffSummary(month)
  const setType = (id: string, type: "FT" | "PT") => () =>
    mutate((m) => {
      const x = m.staff.find((y) => y.id === id)
      if (!x) return
      x.type = type
      if (type === "FT" && !num(x.hours)) x.hours = "160"
    })

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Full-time" value={ft} className="bg-brand-soft" labelClass="text-brand-ink" valueClass="text-brand-strong" />
        <StatTile label="Part-time" value={pt} className="bg-[#FDEEF1]" labelClass="text-[#7A3348]" valueClass="text-[#A12F4F]" />
        <StatTile label="Hours / month" value={Math.round(hours)} className="bg-muted" labelClass="text-ink-2" />
      </div>

      {month.staff.map((it) => {
        const l = staffLine(it)
        const isPT = it.type === "PT"
        return (
          <div key={it.id} className="flex flex-col gap-3 rounded-xl border border-line bg-subtle p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Employee category" className="flex-[1_1_220px]">
                <Input className="font-semibold" value={it.role} onChange={setField(mutate, "staff", it.id, "role")} placeholder="e.g. Barista" />
              </Field>
              <div role="group" aria-label="Contract type" className="flex gap-[3px] rounded-[10px] bg-track p-[3px]">
                <button
                  type="button"
                  aria-pressed={!isPT}
                  onClick={setType(it.id, "FT")}
                  className={cn(segBase, !isPT ? "bg-brand text-white" : "bg-transparent text-ink-2")}
                >
                  Full-time
                </button>
                <button
                  type="button"
                  aria-pressed={isPT}
                  onClick={setType(it.id, "PT")}
                  className={cn(segBase, isPT ? "bg-destructive text-white" : "bg-transparent text-ink-2")}
                >
                  Part-time
                </button>
              </div>
              <RemoveButton label={it.role} onClick={removeItem(mutate, "staff", it.id)} />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              <Field label="Number of employees">
                <NumberInput inputMode="numeric" value={it.count} onChange={setField(mutate, "staff", it.id, "count")} />
              </Field>
              <Field label="Hours per person / month">
                <NumberInput value={it.hours} onChange={setField(mutate, "staff", it.id, "hours")} />
              </Field>
              <Field label="Hourly pay">
                <NumberInput value={it.rate} onChange={setField(mutate, "staff", it.id, "rate")} />
              </Field>
              <Field label="Insurance & contributions (%)">
                <NumberInput value={it.ins} onChange={setField(mutate, "staff", it.id, "ins")} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-2.5 text-sm text-muted-foreground">
              <span>
                Gross pay per person <strong className="font-mono font-medium text-foreground">{fmt(l.gross)}</strong>
              </span>
              <span>
                Contributions per person <strong className="font-mono font-medium text-foreground">{fmt(l.ins)}</strong>
              </span>
              <span className="ml-auto">
                Category total <strong className="font-mono font-medium text-foreground">{fmt(l.total)}</strong>
              </span>
            </div>
          </div>
        )
      })}
      <Button
        variant="dashed"
        className="self-start px-[18px]"
        onClick={() =>
          mutate((m) => void m.staff.push({ id: uid(), role: "", type: "PT", count: "1", hours: "", rate: "", ins: "" }))
        }
      >
        + Add employee category
      </Button>
    </div>
  )
}
