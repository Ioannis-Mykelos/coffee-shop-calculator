import { MapPin } from "lucide-react"

import type { Currency } from "@/lib/expenses"
import { CURRENCIES, type GeoLocation, countryName } from "@/lib/geo"

interface LocationBarProps {
  location: GeoLocation | null
  currency: Currency
  onCurrency: (c: Currency) => void
}

/** Visitor's detected location ("Denmark, Copenhagen") and the currency in use. */
export function LocationBar({ location, currency, onCurrency }: LocationBarProps) {
  const place = location ? [countryName(location.country), location.city].filter(Boolean).join(", ") : "Location unknown"
  const options = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <MapPin aria-hidden="true" className="size-4 text-brand" />
        <span className="text-muted-foreground">Your location</span>
        <strong className="font-medium">{place}</strong>
      </div>
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Currency</span>
        <select
          value={currency}
          onChange={(e) => onCurrency(e.target.value)}
          className="h-8 rounded-lg border border-input bg-card px-2 font-mono text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
