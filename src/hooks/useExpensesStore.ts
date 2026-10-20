"use client"

import { useCallback, useEffect, useState } from "react"

import {
  type Currency,
  type MonthData,
  type MonthsData,
  STORE_KEY,
  isCurrency,
  monthKey,
  sampleMonth,
  shiftMonth,
} from "@/lib/expenses"
import { type GeoLocation, currencyForCountry, currencyForLocation, detectLocation } from "@/lib/geo"

interface StoreState {
  month: string
  data: MonthsData
  currency: Currency
  /** Country the user picked by hand (e.g. when on a VPN); overrides the detected one. */
  country?: string
}

/** Saved state; currency is null on a first visit or for data saved before it was stored. */
function load(): Omit<StoreState, "currency"> & { currency: Currency | null } {
  const month = monthKey(new Date())
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<StoreState>
      if (p?.data) {
        const currency = isCurrency(p.currency) ? p.currency : null
        const country = typeof p.country === "string" && /^[A-Z]{2}$/.test(p.country) ? p.country : undefined
        if (p.data[month]) return { data: p.data, month, currency, country }
        if (p.month && p.data[p.month]) return { data: p.data, month: p.month, currency, country }
      }
    }
  } catch {}
  return { month, data: { [month]: sampleMonth() }, currency: null }
}

/**
 * Month-by-month expense figures, persisted in localStorage.
 * Returns null until loaded on the client (dates and ids are client-only).
 * The visitor's location is looked up on every visit. The currency is picked from it
 * once and then kept, so figures don't change currency when the owner travels.
 */
export function useExpensesStore() {
  const [state, setState] = useState<StoreState | null>(null)
  const [detected, setDetected] = useState<GeoLocation | null>(null)

  useEffect(() => {
    const saved = load()
    const { currency } = saved
    if (currency) setState({ ...saved, currency })
    let cancelled = false
    detectLocation().then((loc) => {
      if (cancelled) return
      setDetected(loc)
      if (!currency) setState({ ...saved, currency: currencyForLocation(loc) })
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

  /** Change the currency label only; amounts are not converted. */
  const setCurrency = useCallback((currency: Currency) => {
    setState((s) => (s ? { ...s, currency } : s))
  }, [])

  /** Pick a country by hand (null = back to the detected one); the currency follows it. */
  const setCountry = useCallback(
    (country: string | null) => {
      setState((s) => {
        if (!s) return s
        const currency = country ? currencyForCountry(country) ?? s.currency : currencyForLocation(detected)
        return { ...s, country: country ?? undefined, currency }
      })
    },
    [detected],
  )

  const country = state?.country
  const location: GeoLocation | null = country
    ? { country, city: country === detected?.country ? detected.city : null }
    : detected

  return { state, location, mutate, go, setCurrency, setCountry }
}
