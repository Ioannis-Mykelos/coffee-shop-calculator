import { type Currency, DEFAULT_CURRENCY, isCurrency } from "@/lib/expenses";

const EURO_COUNTRIES = [
  "AD", "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT",
  "LU", "LV", "MC", "ME", "MT", "NL", "PT", "SI", "SK", "SM", "VA", "XK",
];

/** ISO 3166 country code → ISO 4217 currency. Unlisted countries fall back to EUR. */
const COUNTRY_CURRENCY: Record<string, Currency> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, "EUR"])),
  // Rest of Europe
  GB: "GBP", IM: "GBP", JE: "GBP", GG: "GBP", GI: "GIP",
  DK: "DKK", FO: "DKK", GL: "DKK", SE: "SEK", NO: "NOK", IS: "ISK",
  CH: "CHF", LI: "CHF", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN",
  RS: "RSD", BA: "BAM", MK: "MKD", AL: "ALL", MD: "MDL", UA: "UAH", TR: "TRY",
  GE: "GEL", AM: "AMD", AZ: "AZN", RU: "RUB", BY: "BYN",
  // Americas
  US: "USD", PR: "USD", EC: "USD", SV: "USD", PA: "USD", CA: "CAD", MX: "MXN",
  BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", UY: "UYU", CR: "CRC",
  GT: "GTQ", DO: "DOP", JM: "JMD",
  // Asia & Pacific
  AU: "AUD", NZ: "NZD", JP: "JPY", CN: "CNY", HK: "HKD", TW: "TWD", KR: "KRW",
  SG: "SGD", MY: "MYR", TH: "THB", VN: "VND", ID: "IDR", PH: "PHP", IN: "INR",
  PK: "PKR", BD: "BDT", LK: "LKR",
  // Middle East & Africa
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", IL: "ILS",
  JO: "JOD", LB: "LBP", EG: "EGP", MA: "MAD", TN: "TND", ZA: "ZAR", NG: "NGN",
  KE: "KES", GH: "GHS",
};

export function currencyForCountry(country: string | null | undefined): Currency | null {
  const cur = country ? COUNTRY_CURRENCY[country.toUpperCase()] : undefined;
  return cur && isCurrency(cur) ? cur : null;
}

/** Country from the browser's language setting, e.g. "da-DK" → "DK". */
function browserCountry(): string | null {
  for (const tag of navigator.languages ?? [navigator.language]) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      if (region) return region;
    } catch {}
  }
  return null;
}

/** Country from the visitor's IP, via Netlify's geolocation (see /api/geo). */
async function ipCountry(timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch("/api/geo", { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const body = (await res.json()) as { country?: string | null };
    return body.country ?? null;
  } catch {
    return null;
  }
}

/** Best-guess currency for a first-time visitor: IP country, then browser locale, then EUR. */
export async function detectCurrency(timeoutMs = 2500): Promise<Currency> {
  return currencyForCountry(await ipCountry(timeoutMs)) ?? currencyForCountry(browserCountry()) ?? DEFAULT_CURRENCY;
}
