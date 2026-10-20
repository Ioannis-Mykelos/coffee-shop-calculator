"use client"

import { useMemo, useState } from "react"

import { AnalyticsView } from "@/components/expenses/AnalyticsView"
import { AppHeader } from "@/components/expenses/AppHeader"
import { CategoryTabs } from "@/components/expenses/CategoryTabs"
import { LineItemsEditor, StaffEditor, SuppliesEditor } from "@/components/expenses/Editors"
import { LocationBar } from "@/components/expenses/LocationBar"
import { CupCostCard, ProfitCard } from "@/components/expenses/ProfitCards"
import { BreakEvenCard, BreakdownCard, HistoryCard, TotalCard } from "@/components/expenses/Sidebar"
import { Button } from "@/components/ui/button"
import { useExpensesStore } from "@/hooks/useExpensesStore"
import {
  CATEGORIES,
  type CategoryKey,
  LINE_CATEGORIES,
  type LineCategoryKey,
  computeTotals,
  currencyFormatter,
  monthLabel,
  priceFormatter,
} from "@/lib/expenses"
import { buildXlsx, downloadBlob } from "@/lib/xlsx"

export function ExpensesApp() {
  const { state, location, mutate, go, setCurrency, setCountry } = useExpensesStore()
  const [tab, setTab] = useState<CategoryKey>("premises")
  const [view, setView] = useState<"calc" | "analytics">("calc")
  const [exportMsg, setExportMsg] = useState("")
  const currency = state?.currency
  const fmt = useMemo(() => currencyFormatter(currency), [currency])
  const price = useMemo(() => priceFormatter(currency), [currency])

  if (!state) return <div className="min-h-screen" aria-busy="true" />

  const { data, month } = state
  const m = data[month]
  const totals = computeTotals(m)
  const label = monthLabel(month)
  const cat = CATEGORIES.find((c) => c.key === tab) ?? CATEGORIES[0]
  const isAnalytics = view === "analytics"

  const changeMonth = (delta: number) => {
    go(delta)
    setExportMsg("")
  }

  const submit = () => {
    try {
      downloadBlob(buildXlsx(data, month, state.currency), `My-Coffee-Shop-${month}.xlsx`)
      setExportMsg(`${label} submitted. Spreadsheet saved.`)
    } catch {
      setExportMsg("Could not create the spreadsheet.")
    }
  }

  const clearMonth = () =>
    mutate((mm) => {
      for (const k of LINE_CATEGORIES) mm[k].forEach((x) => (x.amount = ""))
      mm.supplies.forEach((x) => (x.qty = ""))
      mm.staff.forEach((x) => (x.count = ""))
      mm.revenue = ""
      mm.cup.cups = ""
    })

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 pt-8 pb-16">
        <LocationBar
          location={location}
          override={state.country}
          currency={state.currency}
          onCountry={setCountry}
          onCurrency={setCurrency}
        />
        <AppHeader
          monthLabel={label}
          isAnalytics={isAnalytics}
          exportMsg={exportMsg}
          onPrev={() => changeMonth(-1)}
          onNext={() => changeMonth(1)}
          onToggleView={() => setView(isAnalytics ? "calc" : "analytics")}
          onSubmit={submit}
        />

        {isAnalytics ? (
          <AnalyticsView data={data} month={month} fmt={fmt} currency={state.currency} />
        ) : (
          <>
            <CategoryTabs active={tab} totals={totals} fmt={fmt} onPick={setTab} />

            <div className="flex flex-wrap items-start gap-6">
              <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
                <main className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-7">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="m-0 font-display text-[22px] font-bold">{cat.title}</h2>
                      <p className="mt-1 mb-0 text-sm text-muted-foreground">{cat.desc}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Section total</div>
                      <div className="font-mono text-[22px] font-medium">{fmt(totals[cat.key])}</div>
                    </div>
                  </div>

                  {LINE_CATEGORIES.includes(tab as LineCategoryKey) && (
                    <LineItemsEditor month={m} list={tab as LineCategoryKey} mutate={mutate} />
                  )}
                  {tab === "supplies" && <SuppliesEditor month={m} mutate={mutate} fmt={fmt} />}
                  {tab === "staff" && <StaffEditor month={m} mutate={mutate} fmt={fmt} />}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[13px] text-muted-foreground">
                    <span>Figures are saved in this browser. A new month starts as a copy of the month you came from, with sales left blank.</span>
                    <Button variant="destructive" onClick={clearMonth} className="text-[13px]">
                      Clear amounts for {label}
                    </Button>
                  </div>
                </main>
                <CupCostCard month={m} total={totals.total} fmt={fmt} price={price} mutate={mutate} />
              </div>

              <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
                <TotalCard data={data} month={month} totals={totals} fmt={fmt} monthLabel={label} />
                <ProfitCard month={m} total={totals.total} fmt={fmt} mutate={mutate} />
                <BreakdownCard totals={totals} fmt={fmt} />
                <BreakEvenCard month={m} total={totals.total} fmt={fmt} mutate={mutate} />
                <HistoryCard data={data} month={month} fmt={fmt} currency={state.currency} />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
