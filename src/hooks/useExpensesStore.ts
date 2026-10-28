"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  type Currency,
  type MonthData,
  STORE_KEY,
  computeTotals,
  monthKey,
  sampleMonth,
  shiftMonth,
} from "@/lib/expenses"
import { type GeoLocation, currencyForCountry, currencyForLocation, detectLocation } from "@/lib/geo"
import { type Workspace, cleanWorkspace } from "@/lib/workspace"
import { loadWorkspace, saveWorkspace } from "@/lib/workspace-client"

export type StoreMode = "accounts" | "local"

/**
 * Where the figures stand. Local mode is always "saved" (in this browser). Accounts mode saves a moment after the last
 * change; "conflict" means another device saved first, and what it saved is now on screen.
 */
export type SaveStatus = "saved" | "saving" | "failed" | "conflict"

/** How long after the last change the figures are sent to the account */
const SAVE_DELAY_MS = 800

/** The workspace saved in this browser, or null. Currency is null when it was saved before currencies were kept. */
function loadLocal(): (Omit<Workspace, "currency"> & { currency: Currency | null }) | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Workspace>) : null
    if (!parsed?.data) return null
    // Saved before the current month was kept, or the month is missing: open on this month's figures if there are any.
    const now = monthKey(new Date())
    const month = parsed.data[now] ? now : parsed.month
    const clean = cleanWorkspace({ ...parsed, month, currency: parsed.currency ?? "EUR" })
    return clean && { ...clean, currency: parsed.currency ? clean.currency : null }
  } catch {
    return null
  }
}

/** True if any month saved in this browser has figures in it. */
const hasFigures = (w: Pick<Workspace, "data">) => Object.values(w.data).some((m) => computeTotals(m).total > 0)

/** A first workspace: this month, with sample figures to replace. */
const freshWorkspace = (currency: Currency): Workspace => {
  const month = monthKey(new Date())
  return { month, data: { [month]: sampleMonth() }, currency }
}

/**
 * Month-by-month expense figures. Local mode keeps them in localStorage; accounts mode in the owner's account
 * (app/api/workspace), and offers once to bring over figures this browser saved before.
 * `state` is null until loaded on the client (dates and ids are client-only).
 * The visitor's location is looked up on every visit. The currency is picked from it once and then kept, so figures
 * don't change currency when the owner travels.
 */
export function useExpensesStore(mode: StoreMode) {
  const [state, setState] = useState<Workspace | null>(null)
  const [detected, setDetected] = useState<GeoLocation | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [loadFailed, setLoadFailed] = useState(false)
  /** Accounts mode: figures this browser saved before, offered for import into an empty account */
  const [importOffer, setImportOffer] = useState<Workspace | null>(null)

  // Accounts mode: the saved version this browser builds on, whether there are changes to send, and the latest state.
  const version = useRef(0)
  const dirty = useRef(false)
  const saving = useRef(false)
  const latest = useRef<Workspace | null>(null)
  latest.current = state

  /** Every change made here goes through this, so it's saved. */
  const update = useCallback((fn: (s: Workspace) => Workspace) => {
    setState((s) => {
      if (!s) return s
      dirty.current = true
      return fn(s)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const located = detectLocation().then((loc) => {
      if (!cancelled) setDetected(loc)
      return loc
    })

    if (mode === "local") {
      const saved = loadLocal()
      if (saved?.currency) setState({ ...saved, currency: saved.currency })
      else void located.then((loc) => !cancelled && setState(saved ? { ...saved, currency: currencyForLocation(loc) } : freshWorkspace(currencyForLocation(loc))))
      return () => {
        cancelled = true
      }
    }

    void loadWorkspace().then(async (res) => {
      if (cancelled) return
      if (!res.ok) {
        if (res.reason === "unauthorized") window.location.assign("/login?next=/app")
        else setLoadFailed(true)
        return
      }
      version.current = res.version
      const saved = res.workspace && cleanWorkspace(res.workspace)
      if (saved) return setState(saved)
      // A new account: start from sample figures, and offer what this browser saved before, if anything.
      const local = loadLocal()
      const currency = local?.currency ?? currencyForLocation(await located)
      if (cancelled) return
      if (local && hasFigures(local)) setImportOffer({ ...local, currency })
      setState(freshWorkspace(currency))
    })
    return () => {
      cancelled = true
    }
  }, [mode])

  // Local mode: every change is written to this browser.
  useEffect(() => {
    if (mode !== "local" || !state) return
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state))
    } catch {}
  }, [mode, state])

  // Accounts mode: send the figures a moment after the last change, one save at a time.
  const save = useCallback(async () => {
    if (saving.current || !dirty.current || !latest.current) return
    saving.current = true
    dirty.current = false
    setSaveStatus("saving")
    const res = await saveWorkspace(latest.current, version.current)
    saving.current = false
    if (res.ok) {
      version.current = res.version
      if (dirty.current) return void save()
      return setSaveStatus("saved")
    }
    if (res.reason === "conflict") {
      // Another device saved first: show what it saved, rather than overwrite it.
      version.current = res.version
      dirty.current = false
      const theirs = cleanWorkspace(res.workspace)
      if (theirs) setState(theirs)
      return setSaveStatus("conflict")
    }
    if (res.reason === "unauthorized") return window.location.assign("/login?next=/app")
    dirty.current = true
    setSaveStatus("failed")
  }, [])

  useEffect(() => {
    if (mode !== "accounts" || !state || !dirty.current) return
    const timer = setTimeout(() => void save(), SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [mode, state, save])

  // Changes not saved yet: ask before the page closes.
  useEffect(() => {
    if (mode !== "accounts") return
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [mode])

  /** Edit the current month on a deep copy. */
  const mutate = useCallback(
    (fn: (m: MonthData) => void) =>
      update((s) => {
        const m = structuredClone(s.data[s.month])
        fn(m)
        return { ...s, data: { ...s.data, [s.month]: m } }
      }),
    [update],
  )

  /** Move to another month; a new month starts as a copy of the one you came from, minus its sales. */
  const go = useCallback(
    (delta: number) =>
      update((s) => {
        const k = shiftMonth(s.month, delta)
        const data = s.data[k] ? s.data : { ...s.data, [k]: { ...structuredClone(s.data[s.month]), revenue: "" } }
        return { ...s, month: k, data }
      }),
    [update],
  )

  /** Change the currency label only; amounts are not converted. */
  const setCurrency = useCallback((currency: Currency) => update((s) => ({ ...s, currency })), [update])

  /** Pick a country by hand (null = back to the detected one); the currency follows it. */
  const setCountry = useCallback(
    (country: string | null) =>
      update((s) => {
        const currency = country ? currencyForCountry(country) ?? s.currency : currencyForLocation(detected)
        const next: Workspace = { ...s, currency }
        if (country) next.country = country
        else delete next.country
        return next
      }),
    [detected, update],
  )

  /** Answer the import offer: bring this browser's figures into the account, or keep the fresh start. */
  const resolveImport = useCallback(
    (accept: boolean) => {
      const offer = importOffer
      setImportOffer(null)
      if (!offer) return
      if (accept) {
        update(() => offer)
        try {
          window.localStorage.removeItem(STORE_KEY)
        } catch {}
      } else {
        // Keep the fresh start: saving it means the offer isn't made again.
        update((s) => ({ ...s }))
      }
    },
    [importOffer, update],
  )

  const country = state?.country
  const location: GeoLocation | null = country
    ? { country, city: country === detected?.country ? detected.city : null }
    : detected

  return { state, location, saveStatus, loadFailed, importOffer, resolveImport, mutate, go, setCurrency, setCountry }
}
