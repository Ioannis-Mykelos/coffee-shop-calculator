"use client"

import { useCallback, useEffect, useState } from "react"

import {
  type Currency,
  DEFAULT_CURRENCY,
  type MonthData,
  type MonthsData,
  STORE_KEY,
  isCurrency,
  monthKey,
  sampleMonth,
  shiftMonth,
} from "@/lib/expenses"
import { detectCurrency } from "@/lib/geo"

interface StoreState {
  month: string
  data: MonthsData
  currency: Currency
}

/** Saved state, or null on a first visit. Data saved before currency was stored is in EUR. */
function load(): StoreState | null {
  const month = monthKey(new Date())
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<StoreState>
      if (p?.data) {
        const currency = isCurrency(p.currency) ? p.currency : DEFAULT_CURRENCY
        if (p.data[month]) return { data: p.data, month, currency }
        if (p.month && p.data[p.month]) return { data: p.data, month: p.month, currency }
      }
    }
  } catch {}
  return null
}

/**
 * Month-by-month expense figures, persisted in localStorage.
 * Returns null until loaded on the client (dates and ids are client-only).
 * On a first visit the currency is picked from the visitor's location, then kept,
 * so figures don't change currency when the owner travels.
 */
export function useExpensesStore() {
  const [state, setState] = useState<StoreState | null>(null)

  useEffect(() => {
    const saved = load()
    if (saved) {
      setState(saved)
      return
    }
    let cancelled = false
    detectCurrency().then((currency) => {
      if (cancelled) return
      const month = monthKey(new Date())
      setState({ month, data: { [month]: sampleMonth() }, currency })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state) return
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

  /** Edit the current month on a deep copy. */
  const mutate = useCallback((fn: (m: MonthData) => void) => {
    setState((s) => {
      if (!s) return s
      const m = structuredClone(s.data[s.month])
      fn(m)
      return { ...s, data: { ...s.data, [s.month]: m } }
    })
  }, [])

  /** Move to another month; a new month starts as a copy of the one you came from. */
  const go = useCallback((delta: number) => {
    setState((s) => {
      if (!s) return s
      const k = shiftMonth(s.month, delta)
      const data = s.data[k] ? s.data : { ...s.data, [k]: structuredClone(s.data[s.month]) }
      return { ...s, month: k, data }
    })
  }, [])

  return { state, mutate, go }
}
