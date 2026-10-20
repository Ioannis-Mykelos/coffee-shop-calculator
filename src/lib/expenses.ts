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
/** How much of one supply item goes into one cup, in that item's unit. */
export interface RecipeItem { id: string; supplyId: string; qty: string }
export interface CupSettings {
  recipe: RecipeItem[];
  /** Cups sold this month; rent, staff and the rest are shared across them. */
  cups: string;
  /** Target profit margin on the selling price, in %. */
  margin: string;
}

export interface MonthData {
  premises: LineItem[];
  utilities: LineItem[];
  supplies: SupplyItem[];
  staff: StaffItem[];
  other: LineItem[];
  days: string;
  avgSale: string;
  /** Actual sales this month, excl. VAT. Blank until the month's takings are known. */
  revenue: string;
  cup: CupSettings;
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
/** Like currencyFormatter but with cents, for per-cup prices. */
export function priceFormatter(cur: Currency = DEFAULT_CURRENCY) {
  const nf = new Intl.NumberFormat(LOCALES[cur], { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n: number) => nf.format(n);
}
export function compactFormatter(cur: Currency = DEFAULT_CURRENCY) {
  const cf = new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, notation: "compact", maximumFractionDigits: 1 });
  return (n: number) => cf.format(n);
}

export function sampleMonth(): MonthData {
  const m: Omit<MonthData, "cup"> = {
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
    revenue: "26000",
  };
  return { ...m, cup: defaultCup(m.supplies, "4500") };
}

/** Typical amounts per cup, matched to supply items by name. */
const RECIPE_GUESS: [RegExp, Record<string, string>][] = [
  [/bean|coffee/i, { kg: "0.018", g: "18" }],
  [/milk/i, { l: "0.15", ml: "150" }],
  [/cup/i, { pcs: "1" }],
  [/lid/i, { pcs: "1" }],
];

/** A starting recipe built from the month's supplies (beans, milk, cup, lid). */
export function defaultCup(supplies: SupplyItem[], cups = ""): CupSettings {
  const recipe: RecipeItem[] = [];
  for (const [re, perUnit] of RECIPE_GUESS) {
    const s = supplies.find((x) => re.test(x.label) && !recipe.some((r) => r.supplyId === x.id));
    const qty = s && perUnit[s.unit.trim().toLowerCase()];
    if (s && qty) recipe.push({ id: uid(), supplyId: s.id, qty });
  }
  return { recipe, cups, margin: "30" };
}

/** Fill in fields added after a month was saved. */
export function withDefaults(m: MonthData): MonthData {
  const p = m as Partial<MonthData> & MonthData;
  return {
    ...p,
    revenue: typeof p.revenue === "string" ? p.revenue : "",
    cup: p.cup && Array.isArray(p.cup.recipe) ? p.cup : defaultCup(p.supplies ?? []),
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

/** Profit or loss once the month's actual sales are entered; null while sales are blank. */
export function profitOf(m: MonthData, total: number) {
  if (!String(m.revenue ?? "").trim()) return null;
  const revenue = num(m.revenue);
  const profit = revenue - total;
  const be = breakEven(m, total);
  const customersDay = be.avg > 0 && be.days > 0 ? revenue / be.avg / be.days : 0;
  return {
    revenue,
    profit,
    margin: revenue > 0 ? profit / revenue : 0,
    /** Sales as a share of what's needed to break even (1 = exactly break-even). */
    coverage: total > 0 ? revenue / total : 0,
    customersDay,
    customersNeededDay: be.customersDay,
  };
}

/** What one cup costs: its ingredients plus an equal share of every other cost. */
export function cupCost(m: MonthData, total: number) {
  const lines = (m.cup?.recipe ?? []).map((r) => {
    const s = m.supplies.find((x) => x.id === r.supplyId);
    return { ...r, supply: s, cost: s ? num(r.qty) * num(s.price) : 0 };
  });
  const ingredients = lines.reduce((a, x) => a + x.cost, 0);
  const cups = num(m.cup?.cups);
  const overhead = cups > 0 ? Math.max(0, total - ingredients * cups) / cups : 0;
  const full = ingredients + overhead;
  const margin = Math.min(Math.max(num(m.cup?.margin), 0), 95) / 100;
  const revenue = num(m.revenue);
  return {
    lines,
    ingredients,
    cups,
    overhead,
    full,
    margin,
    price: full / (1 - margin),
    /** Average takings per cup sold, when sales are entered. */
    earnedPerCup: cups > 0 && revenue > 0 ? revenue / cups : 0,
  };
}
