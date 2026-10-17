"use client"

import { useCallback, useEffect, useState } from "react"

import {
  type MonthData,
  type MonthsData,
  STORE_KEY,
  monthKey,
  sampleMonth,
  shiftMonth,
} from "@/lib/expenses"

interface StoreState {
  month: string
  data: MonthsData
}

function load(): StoreState {
  const month = monthKey(new Date())
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<StoreState>
      if (p?.data) {
        if (p.data[month]) return { data: p.data, month }
        if (p.month && p.data[p.month]) return { data: p.data, month: p.month }
      }
    }
  } catch {}
  return { month, data: { [month]: sampleMonth() } }
}

/**
 * Month-by-month expense figures, persisted in localStorage.
 * Returns null until loaded on the client (dates and ids are client-only).
 */
export function useExpensesStore() {
  const [state, setState] = useState<StoreState | null>(null)

  useEffect(() => {
    setState(load())
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
      return { month: k, data }
    })
  }, [])

  return { state, mutate, go }
}
