import { MapPin } from "lucide-react"

import type { Currency } from "@/lib/expenses"
import { COUNTRIES, CURRENCIES, type GeoLocation, countryName } from "@/lib/geo"

interface LocationBarProps {
  location: GeoLocation | null
  /** Country the user picked by hand, if any. */
  override: string | undefined
  currency: Currency
  onCountry: (c: string | null) => void
  onCurrency: (c: Currency) => void
}

const selectClass =
  "h-8 rounded-lg border border-input bg-card px-2 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

const COUNTRY_OPTIONS = COUNTRIES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
  a.name.localeCompare(b.name, "en"),
)

/** Visitor's location ("Denmark, Copenhagen") with its flag, and the currency in use. Both can be changed. */
export function LocationBar({ location, override, currency, onCountry, onCurrency }: LocationBarProps) {
  const code = location?.country
  const known = code && COUNTRIES.includes(code)
  const currencies = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]

  return (
    <div className="flex min-h-[54px] flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-3.5 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* Kept short so it fits beside the view tabs; the pin says what it is. */}
        <MapPin aria-hidden="true" className="size-4 text-brand" />
        <span className="sr-only">Your location</span>
        {known ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed
          <img src={`/flags/${code}.svg`} alt="" width={21} height={14} className="rounded-[2px] shadow-[0_0_0_1px_var(--border)]" />
        ) : null}
        <strong className="font-medium">
          {code ? [countryName(code), location.city].filter(Boolean).join(", ") : "Location unknown"}
        </strong>
        <label className="flex items-center gap-2">
          <span className="sr-only">Change country</span>
          <select
            value={override ?? ""}
            onChange={(e) => onCountry(e.target.value || null)}
            className={`${selectClass} max-w-32`}
          >
            <option value="">Auto-detect</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Currency</span>
        <select value={currency} onChange={(e) => onCurrency(e.target.value)} className={`${selectClass} font-mono`}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
