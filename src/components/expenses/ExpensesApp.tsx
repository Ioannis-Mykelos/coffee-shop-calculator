"use client"

import { useMemo, useState } from "react"

import { AnalyticsView } from "@/components/expenses/AnalyticsView"
import { AppHeader, type View } from "@/components/expenses/AppHeader"
import { CategoryTabs } from "@/components/expenses/CategoryTabs"
import { LineItemsEditor, StaffEditor, SuppliesEditor } from "@/components/expenses/Editors"
import { LocationBar } from "@/components/expenses/LocationBar"
import { MenuView } from "@/components/expenses/MenuView"
import { TakingsView } from "@/components/expenses/TakingsView"
import { BreakdownCard, HistoryCard, TotalCard } from "@/components/expenses/Sidebar"
import { WhatIfView } from "@/components/expenses/WhatIfView"
import { Button } from "@/components/ui/button"
import { type StoreMode, useExpensesStore } from "@/hooks/useExpensesStore"
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
import type { User } from "@/lib/auth-client"
import { buildXlsx, downloadBlob } from "@/lib/xlsx"
import { ImportBanner, LoadFailed } from "@/components/expenses/SyncNotices"

/**
 * The calculator. `mode` "accounts": figures are saved in the signed-in owner's account (`user`); "local": in this
 * browser, with no login.
 */
export function ExpensesApp({ mode, user }: { mode: StoreMode; user?: User }) {
  const { state, location, saveStatus, loadFailed, importOffer, resolveImport, mutate, go, setCurrency, setCountry } = useExpensesStore(mode)
  const [tab, setTab] = useState<CategoryKey>("premises")
  const [view, setView] = useState<View>("calc")
  const [exportMsg, setExportMsg] = useState("")
  const currency = state?.currency
  const fmt = useMemo(() => currencyFormatter(currency), [currency])
  const price = useMemo(() => priceFormatter(currency), [currency])

  if (loadFailed) return <LoadFailed />
  if (!state) return <div className="min-h-screen" aria-busy="true" />

  const { data, month } = state
  const m = data[month]
  const totals = computeTotals(m)
  const label = monthLabel(month)
  const cat = CATEGORIES.find((c) => c.key === tab) ?? CATEGORIES[0]

  const changeMonth = (delta: number) => {
    go(delta)
    setExportMsg("")
  }

  const submit = () => {
    try {
      downloadBlob(buildXlsx(data, month, state.currency), `My-Coffee-Shop-${month}.xlsx`)
      setExportMsg(`Spreadsheet for ${label} downloaded.`)
    } catch {
      setExportMsg("Could not create the spreadsheet.")
    }
  }

  const clearMonth = () =>
    mutate((mm) => {
      for (const k of LINE_CATEGORIES) mm[k].forEach((x) => (x.amount = ""))
      mm.supplies.forEach((x) => (x.qty = ""))
      mm.consumables.forEach((x) => (x.qty = ""))
      mm.staff.forEach((x) => (x.count = ""))
      mm.menu.drinks.forEach((x) => (x.cups = ""))
      mm.revenue = ""
      mm.takings = {}
    })

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 pt-8 pb-16">
        <AppHeader
          monthLabel={label}
          user={user}
          saveStatus={mode === "accounts" ? saveStatus : null}
          view={view}
          exportMsg={exportMsg}
          onPrev={() => changeMonth(-1)}
          onNext={() => changeMonth(1)}
          onView={setView}
          onSubmit={submit}
          toolbar={
            <LocationBar
              location={location}
              override={state.country}
              currency={state.currency}
              onCountry={setCountry}
              onCurrency={setCurrency}
            />
          }
        />
        {importOffer && <ImportBanner months={Object.keys(importOffer.data).length} onAnswer={resolveImport} />}

        {view === "analytics" ? (
          <AnalyticsView data={data} month={month} fmt={fmt} currency={state.currency} />
        ) : view === "menu" ? (
          <MenuView month={m} total={totals.total} currency={state.currency} mutate={mutate} fmt={fmt} price={price} />
        ) : view === "takings" ? (
          <TakingsView month={m} monthKey={month} total={totals.total} mutate={mutate} fmt={fmt} onView={setView} />
        ) : view === "whatif" ? (
          <WhatIfView key={month} month={m} fmt={fmt} price={price} />
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
                  {tab === "consumables" && (
                    <SuppliesEditor month={m} list="consumables" mutate={mutate} fmt={fmt} placeholder="e.g. Croissant" addLabel="+ Add consumable" />
                  )}
                  {tab === "staff" && <StaffEditor month={m} mutate={mutate} fmt={fmt} />}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[13px] text-muted-foreground">
                    <span>
                      {mode === "accounts" ? "Figures are saved in your account." : "Figures are saved in this browser."} A new month starts as a copy
                      of the month you came from, with sales left blank.
                    </span>
                    <Button variant="destructive" onClick={clearMonth} className="text-[13px]">
                      Clear amounts for {label}
                    </Button>
                  </div>
                </main>
              </div>

              <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
                <TotalCard data={data} month={month} totals={totals} fmt={fmt} monthLabel={label} />
                <BreakdownCard totals={totals} fmt={fmt} />
                <HistoryCard data={data} month={month} fmt={fmt} currency={state.currency} />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
