/** ISO 4217 code, e.g. "EUR". Picked from the visitor's country on first visit (see lib/geo). */
export type Currency = string;
export const DEFAULT_CURRENCY: Currency = "EUR";

export function isCurrency(v: unknown): v is Currency {
  if (typeof v !== "string" || !/^[A-Z]{3}$/.test(v)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: v });
    return true;
  } catch {
    return false;
  }
}

export const STORE_KEY = "my-coffee-shop-eur-v1";

export type CategoryKey = "premises" | "utilities" | "supplies" | "staff" | "other";
export type LineCategoryKey = "premises" | "utilities" | "other";

export interface Category {
  key: CategoryKey;
  label: string;
  color: string;
  title: string;
  desc: string;
}

export const CATEGORIES: Category[] = [
  { key: "premises", label: "Rent & premises", color: "var(--chart-1)", title: "Rent & premises", desc: "Fixed costs for the space itself: rent, shared charges and premises insurance." },
  { key: "utilities", label: "Utilities", color: "var(--chart-2)", title: "Utilities", desc: "Bills that change month to month. Type in this month’s electricity, water, heating and internet." },
  { key: "supplies", label: "Supplies", color: "var(--chart-3)", title: "Supplies & consumables", desc: "To-go cups, lids, beans, milk, sugar and the rest. Quantity × price per unit." },
  { key: "staff", label: "Staff", color: "var(--chart-4)", title: "Staff", desc: "One row per employee category. Pay is hours × hourly rate, plus insurance and employer contributions." },
  { key: "other", label: "Other", color: "var(--chart-5)", title: "Other expenses", desc: "Everything else: card fees, cleaning, repairs, marketing, software, accountant." },
];

export const LINE_CATEGORIES: LineCategoryKey[] = ["premises", "utilities", "other"];

export interface LineItem { id: string; label: string; amount: string }
export interface SupplyItem { id: string; label: string; qty: string; unit: string; price: string }
export interface StaffItem { id: string; role: string; type: "FT" | "PT"; count: string; hours: string; rate: string; ins: string }

export interface MonthData {
  premises: LineItem[];
  utilities: LineItem[];
  supplies: SupplyItem[];
  staff: StaffItem[];
  other: LineItem[];
  days: string;
  avgSale: string;
}

/** Keyed by "YYYY-MM". */
export type MonthsData = Record<string, MonthData>;

export type Totals = Record<CategoryKey, number> & { total: number };

/** Number style per currency; others use the browser's own locale. */
const LOCALES: Record<string, string> = { DKK: "da-DK", EUR: "de-DE", USD: "en-US", GBP: "en-GB" };

export function uid() {
  return "i" + Math.random().toString(36).slice(2, 9);
}

/** Lenient parse: accepts "1 200,50" as well as "1200.50". */
export function num(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
}

export function monthKey(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
export function monthDate(k: string) {
  const [y, m] = k.split("-");
  return new Date(+y, +m - 1, 1);
}
export function shiftMonth(k: string, delta: number) {
  const d = monthDate(k);
  return monthKey(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}
export function monthName(k: string, opts: Intl.DateTimeFormatOptions) {
  return monthDate(k).toLocaleString("en-GB", opts);
}
export function monthLabel(k: string) {
  return monthName(k, { month: "long", year: "numeric" });
}
/** "Oct26" style label used on chart axes. */
export function monthShort(k: string) {
  return monthName(k, { month: "short" }) + k.slice(2, 4);
}

export function currencyFormatter(cur: Currency = DEFAULT_CURRENCY) {
  const nf = new Intl.NumberFormat(LOCALES[cur], { style: "currency", currency: cur, maximumFractionDigits: 0 });
  return (n: number) => nf.format(Math.round(n));
}
export function compactFormatter(cur: Currency = DEFAULT_CURRENCY) {
  const cf = new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, notation: "compact", maximumFractionDigits: 1 });
  return (n: number) => cf.format(n);
}

export function sampleMonth(): MonthData {
  return {
    premises: [
      { id: uid(), label: "Monthly rent", amount: "3000" },
      { id: uid(), label: "Shared building charges", amount: "250" },
      { id: uid(), label: "Premises insurance", amount: "90" },
    ],
    utilities: [
      { id: uid(), label: "Electricity", amount: "560" },
      { id: uid(), label: "Water", amount: "80" },
      { id: uid(), label: "Heating", amount: "120" },
      { id: uid(), label: "Internet & phone", amount: "60" },
    ],
    supplies: [
      { id: uid(), label: "To-go cups", qty: "3000", unit: "pcs", price: "0.11" },
      { id: uid(), label: "Lids", qty: "3000", unit: "pcs", price: "0.05" },
      { id: uid(), label: "Coffee beans", qty: "40", unit: "kg", price: "22" },
      { id: uid(), label: "Milk", qty: "400", unit: "L", price: "1.3" },
      { id: uid(), label: "Sugar & sweeteners", qty: "1", unit: "lot", price: "60" },
      { id: uid(), label: "Napkins & stirrers", qty: "1", unit: "lot", price: "40" },
    ],
    staff: [
      { id: uid(), role: "Barista", type: "FT", count: "2", hours: "160", rate: "23", ins: "10" },
      { id: uid(), role: "Barista", type: "PT", count: "3", hours: "60", rate: "21", ins: "10" },
      { id: uid(), role: "Shift lead", type: "FT", count: "1", hours: "160", rate: "27", ins: "10" },
    ],
    other: [
      { id: uid(), label: "Card payment fees", amount: "250" },
      { id: uid(), label: "Cleaning", amount: "70" },
      { id: uid(), label: "Repairs & maintenance", amount: "110" },
      { id: uid(), label: "Marketing", amount: "130" },
      { id: uid(), label: "POS & software", amount: "90" },
      { id: uid(), label: "Accountant", amount: "200" },
    ],
    days: "30",
    avgSale: "6",
  };
}

export function staffLine(x: StaffItem) {
  const gross = num(x.hours) * num(x.rate);
  const ins = (gross * num(x.ins)) / 100;
  const count = num(x.count);
  return { gross, ins, count, total: count * (gross + ins) };
}

export function computeTotals(m: MonthData): Totals {
  const sumAmt = (xs: LineItem[] = []) => xs.reduce((a, x) => a + num(x.amount), 0);
  const t = {
    premises: sumAmt(m.premises),
    utilities: sumAmt(m.utilities),
    other: sumAmt(m.other),
    supplies: (m.supplies ?? []).reduce((a, x) => a + num(x.qty) * num(x.price), 0),
    staff: (m.staff ?? []).reduce((a, x) => a + staffLine(x).total, 0),
    total: 0,
  };
  t.total = t.premises + t.utilities + t.other + t.supplies + t.staff;
  return t;
}

export function staffSummary(m: MonthData) {
  let ft = 0, pt = 0, hours = 0;
  for (const x of m.staff ?? []) {
    const c = num(x.count);
    if (x.type === "PT") pt += c; else ft += c;
    hours += c * num(x.hours);
  }
  return { ft, pt, hours };
}

export function breakEven(m: MonthData, total: number) {
  const days = num(m.days), avg = num(m.avgSale);
  return {
    days,
    avg,
    perDay: days > 0 ? total / days : 0,
    customersMonth: avg > 0 ? Math.ceil(total / avg) : 0,
    customersDay: avg > 0 && days > 0 ? Math.ceil(total / avg / days) : 0,
  };
}
