/** ISO 4217 code, e.g. "EUR". Picked from the visitor's country on first visit (see lib/geo). */
export type Currency = string;
export const DEFAULT_CURRENCY: Currency = "EUR";

/** The ISO 4217 codes this browser or server knows, or null where the list isn't available (older browsers). */
let known: Set<string> | null | undefined;
const knownCurrencies = () =>
  (known ??= typeof Intl.supportedValuesOf === "function" ? new Set(Intl.supportedValuesOf("currency")) : null);

/** A real currency code. Intl.NumberFormat formats any three letters, so the list of known codes decides. */
export function isCurrency(v: unknown): v is Currency {
  if (typeof v !== "string" || !/^[A-Z]{3}$/.test(v)) return false;
  const list = knownCurrencies();
  if (list) return list.has(v);
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: v });
    return true;
  } catch {
    return false;
  }
}

export const STORE_KEY = "my-coffee-shop-eur-v1";

export type CategoryKey = "premises" | "utilities" | "supplies" | "consumables" | "staff" | "other";
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
  { key: "supplies", label: "Supplies", color: "var(--chart-3)", title: "Coffee supplies", desc: "To-go cups, lids, beans, milk, sugar and the rest. Quantity × price per unit." },
  { key: "consumables", label: "Consumables", color: "var(--chart-6)", title: "Consumables", desc: "Food and drinks you buy in to sell: juice, overnight pudding, pastries and so on. Quantity × price per unit." },
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
  /** Margin added on top of the ingredients cost, in % (120 means price = cost × 2.2). */
  margin: string;
  /** VAT rate added on top of the final price, in %. */
  vat: string;
}

/**
 * A drink or food item on the menu: its recipe from Supplies and Consumables, its menu price (VAT included) and how
 * many sell a month.
 */
export interface Drink {
  id: string;
  /** Food is priced like a drink but left out of the break-even's average drink. */
  kind: "drink" | "food";
  name: string;
  price: string;
  /** This drink's VAT in %, or blank for the menu's */
  vat: string;
  cups: string;
  recipe: RecipeItem[];
}
export interface MenuSettings {
  drinks: Drink[];
  /** VAT on drinks, in %. Menu prices include it. */
  vat: string;
  /** VAT on food, in %, or blank for the drinks' rate */
  foodVat: string;
  /** The margin a suggested price aims for, in % of the price excl. VAT. */
  target: string;
  /** Plant milk: the supply it stands in for, the plant milk supply, and its extra charge (VAT included). */
  plantMilk: { milkId: string; plantId: string; surcharge: string };
}

export interface MonthData {
  premises: LineItem[];
  utilities: LineItem[];
  supplies: SupplyItem[];
  /** Food and drinks bought in for resale; same shape as supplies. */
  consumables: SupplyItem[];
  staff: StaffItem[];
  other: LineItem[];
  days: string;
  /** Average drinks per customer; each is sold at the menu's average drink price incl. VAT. */
  coffeesPerCustomer: string;
  /** Average spend per customer on other consumables (juice, pastries…), incl. VAT. */
  extrasPerCustomer: string;
  /** Actual sales this month, excl. VAT. Blank until the month's takings are known. */
  revenue: string;
  /** The till's total each day, VAT included, keyed by day of the month ("1"…"31"); days not entered are missing. */
  takings: Record<string, string>;
  /** The single cup recipe from before menus: only read to build a month's first menu (defaultMenu). */
  cup: CupSettings;
  /** Selling consumables: margin on cost and VAT, both in %. */
  consumablePricing: { margin: string; vat: string };
  menu: MenuSettings;
}

/** Keyed by "YYYY-MM". */
export type MonthsData = Record<string, MonthData>;

export type Totals = Record<CategoryKey, number> & { total: number };

/** Number style per currency; others use the browser's own locale. */
const LOCALES: Record<string, string> = { DKK: "da-DK", EUR: "de-DE", USD: "en-US", GBP: "en-GB" };

export function uid() {
  return "i" + Math.random().toString(36).slice(2, 9);
}

/**
 * Lenient parse of a typed amount, in either number style: "1200.50", "1,200.50", "1 200,50", "1.200,50" and "1,5"
 * all work. With both separators, the last one is the decimal point. One kind used more than once groups thousands,
 * and so does a single one followed by exactly three digits ("1,200" → 1200, "1.500" → 1500), unless the whole part
 * is 0 ("0.018" stays a fraction: per-cup amounts are small).
 */
export function num(v: string | number | null | undefined) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/[\s '’]/g, "");
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    s = s.replace(decimal === "." ? /,/g : /\./g, "").replace(",", ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = s.split(sep);
    const thousands = parts.length > 2 || (parts[1].length === 3 && /^-?\d*[1-9]\d*$/.test(parts[0]));
    s = thousands ? parts.join("") : parts.join(".");
  }
  const n = parseFloat(s);
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
  const m: Omit<MonthData, "cup" | "consumablePricing" | "menu" | "takings"> = {
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
    consumables: [
      { id: uid(), label: "Orange juice", qty: "200", unit: "bottles", price: "1.2" },
      { id: uid(), label: "Overnight pudding", qty: "150", unit: "pcs", price: "0.9" },
      { id: uid(), label: "Pastries", qty: "600", unit: "pcs", price: "0.8" },
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
    coffeesPerCustomer: "1",
    extrasPerCustomer: "2",
    revenue: "26000",
  };
  const [cups, lids, beans, milk] = m.supplies;
  const pastries = m.consumables[2];
  const recipe = (milkL: string) => [
    { id: uid(), supplyId: beans.id, qty: "0.018" },
    ...(milkL ? [{ id: uid(), supplyId: milk.id, qty: milkL }] : []),
    { id: uid(), supplyId: cups.id, qty: "1" },
    { id: uid(), supplyId: lids.id, qty: "1" },
  ];
  const menu: MenuSettings = {
    drinks: [
      { id: uid(), kind: "drink", name: "Espresso", price: "2.80", vat: "", cups: "700", recipe: recipe("") },
      { id: uid(), kind: "drink", name: "Cappuccino", price: "3.60", vat: "", cups: "1100", recipe: recipe("0.15") },
      { id: uid(), kind: "drink", name: "Caffè latte", price: "3.90", vat: "", cups: "800", recipe: recipe("0.25") },
      { id: uid(), kind: "drink", name: "Flat white", price: "3.80", vat: "", cups: "400", recipe: recipe("0.12") },
      { id: uid(), kind: "food", name: "Croissant", price: "3.50", vat: "", cups: "500", recipe: [{ id: uid(), supplyId: pastries.id, qty: "1" }] },
    ],
    vat: "25",
    foodVat: "",
    target: "70",
    plantMilk: { milkId: milk.id, plantId: "", surcharge: "" },
  };
  return { ...m, takings: {}, cup: { ...defaultCup(m.supplies), margin: "250", vat: "25" }, consumablePricing: { margin: "150", vat: "25" }, menu };
}

/** The menu for a month saved before menus existed: one drink, from its cup recipe and price. */
export function defaultMenu(m: Pick<MonthData, "supplies" | "cup">): MenuSettings {
  const c = cupCost(m);
  const milk = m.supplies.find((s) => /milk/i.test(s.label) && !PLANT_MILK.test(s.label));
  const plant = m.supplies.find((s) => PLANT_MILK.test(s.label));
  return {
    drinks: [
      {
        id: uid(),
        kind: "drink",
        name: "Coffee",
        price: c.priceInclVat > 0 ? c.priceInclVat.toFixed(2) : "",
        vat: "",
        cups: "",
        recipe: m.cup.recipe.map((r) => ({ ...r, id: uid() })),
      },
    ],
    vat: m.cup.vat,
    foodVat: "",
    target: "70",
    plantMilk: { milkId: milk?.id ?? "", plantId: plant?.id ?? "", surcharge: "" },
  };
}

const PLANT_MILK = /oat|soy|almond|plant|coconut|rice/i;

/** Typical amounts per cup, matched to supply items by name. */
const RECIPE_GUESS: [RegExp, Record<string, string>][] = [
  [/bean|coffee/i, { kg: "0.018", g: "18" }],
  [/milk/i, { l: "0.15", ml: "150" }],
  [/cup/i, { pcs: "1" }],
  [/lid/i, { pcs: "1" }],
];

/** A starting recipe built from the month's supplies (beans, milk, cup, lid). */
export function defaultCup(supplies: SupplyItem[]): CupSettings {
  const recipe: RecipeItem[] = [];
  for (const [re, perUnit] of RECIPE_GUESS) {
    const s = supplies.find((x) => re.test(x.label) && !recipe.some((r) => r.supplyId === x.id));
    const qty = s && perUnit[s.unit.trim().toLowerCase()];
    if (s && qty) recipe.push({ id: uid(), supplyId: s.id, qty });
  }
  return { recipe, margin: "30", vat: "" };
}

/** Fill in fields added after a month was saved. */
export function withDefaults(m: Omit<MonthData, "menu" | "takings"> & { menu?: MenuSettings; takings?: Record<string, string> }): MonthData {
  const p = m as Partial<MonthData> & Omit<MonthData, "menu" | "takings">;
  const filled: Omit<MonthData, "menu"> = {
    ...p,
    revenue: typeof p.revenue === "string" ? p.revenue : "",
    takings: p.takings && typeof p.takings === "object" ? p.takings : {},
    consumables: Array.isArray(p.consumables) ? p.consumables : [],
    consumablePricing: p.consumablePricing ?? { margin: "150", vat: "" },
    coffeesPerCustomer: typeof p.coffeesPerCustomer === "string" ? p.coffeesPerCustomer : "1",
    extrasPerCustomer: typeof p.extrasPerCustomer === "string" ? p.extrasPerCustomer : "",
    cup: p.cup && Array.isArray(p.cup.recipe) ? { ...p.cup, vat: p.cup.vat ?? "" } : defaultCup(p.supplies ?? []),
  };
  const menu = p.menu && Array.isArray(p.menu.drinks)
    ? { ...p.menu, foodVat: p.menu.foodVat ?? "", drinks: p.menu.drinks.map((d) => ({ ...d, kind: d.kind === "food" ? ("food" as const) : ("drink" as const) })) }
    : defaultMenu(filled);
  return { ...filled, menu };
}

export function staffLine(x: StaffItem) {
  const gross = num(x.hours) * num(x.rate);
  const ins = (gross * num(x.ins)) / 100;
  const count = num(x.count);
  return { gross, ins, count, total: count * (gross + ins) };
}

const sumQty = (xs: SupplyItem[] = []) => xs.reduce((a, x) => a + num(x.qty) * num(x.price), 0);

export function computeTotals(m: MonthData): Totals {
  const sumAmt = (xs: LineItem[] = []) => xs.reduce((a, x) => a + num(x.amount), 0);
  const t = {
    premises: sumAmt(m.premises),
    utilities: sumAmt(m.utilities),
    other: sumAmt(m.other),
    supplies: sumQty(m.supplies),
    consumables: sumQty(m.consumables),
    staff: (m.staff ?? []).reduce((a, x) => a + staffLine(x).total, 0),
    total: 0,
  };
  t.total = t.premises + t.utilities + t.other + t.supplies + t.consumables + t.staff;
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

const isSet = (v: string | undefined) => String(v ?? "").trim() !== "";

/**
 * An item's VAT as a fraction: its own rate when it has one (take-away and sit-in can differ), else the menu's for
 * its kind (food falls back to the drinks' rate when food has none).
 */
export function drinkVat(m: Pick<MonthData, "menu">, d: Drink) {
  const menuRate = d.kind === "food" && isSet(m.menu.foodVat) ? m.menu.foodVat : m.menu.vat;
  return Math.max(num(isSet(d.vat) ? d.vat : menuRate), 0) / 100;
}

/**
 * The average drink on the menu, with VAT (`price`) and without it at each drink's own rate (`net`): weighted by cups
 * sold when they're known, else the plain average of the drinks with a price.
 */
export function averageDrink(m: Pick<MonthData, "menu">) {
  const priced = m.menu.drinks
    .filter((d) => d.kind !== "food")
    .map((d) => ({ price: num(d.price), net: num(d.price) / (1 + drinkVat(m, d)), cups: Math.max(num(d.cups), 0) }))
    .filter((d) => d.price > 0);
  const cups = priced.reduce((a, d) => a + d.cups, 0);
  const avg = (k: "price" | "net") =>
    cups > 0 ? priced.reduce((a, d) => a + d[k] * d.cups, 0) / cups : priced.length ? priced.reduce((a, d) => a + d[k], 0) / priced.length : 0;
  return { price: avg("price"), net: avg("net") };
}

export function breakEven(m: MonthData, total: number) {
  const days = num(m.days);
  const drink = averageDrink(m);
  const cupPrice = drink.price;
  /** The average drink's VAT rate, across drinks with different rates */
  const vat = drink.net > 0 ? drink.price / drink.net - 1 : Math.max(num(m.menu.vat), 0) / 100;
  const coffees = num(m.coffeesPerCustomer);
  const coffeeSpend = coffees * cupPrice;
  const extras = num(m.extrasPerCustomer);
  const extrasVat = Math.max(num(m.consumablePricing?.vat), 0) / 100;
  /** What one customer pays on average, incl. VAT. */
  const avgGross = coffeeSpend + extras;
  /** Costs are excl. VAT, so they're covered by the sale minus its VAT (each at its own rate). */
  const avg = coffeeSpend / (1 + vat) + extras / (1 + extrasVat);
  return {
    days,
    coffees,
    /** The menu's average drink price, VAT included */
    cupPrice,
    coffeeSpend,
    extras,
    avg,
    avgGross,
    vat,
    extrasVat,
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

/** What the old single cup's ingredients cost, and its price with the margin on that cost: for months saved before menus. */
export function cupCost(m: Pick<MonthData, "supplies" | "cup">) {
  const lines = (m.cup?.recipe ?? []).map((r) => {
    const s = m.supplies.find((x) => x.id === r.supplyId);
    return { ...r, supply: s, cost: s ? num(r.qty) * num(s.price) : 0 };
  });
  const ingredients = lines.reduce((a, x) => a + x.cost, 0);
  const margin = Math.max(num(m.cup?.margin), 0) / 100;
  const price = ingredients * (1 + margin);
  const vat = Math.max(num(m.cup?.vat), 0) / 100;
  return { lines, ingredients, margin, price, profit: price - ingredients, vat, vatAmount: price * vat, priceInclVat: price * (1 + vat) };
}

/** Selling price of each consumable: its cost plus the margin, then VAT on top. */
export function consumablePrices(m: MonthData) {
  const margin = Math.max(num(m.consumablePricing?.margin), 0) / 100;
  const vat = Math.max(num(m.consumablePricing?.vat), 0) / 100;
  const items = (m.consumables ?? [])
    .filter((x) => x.label.trim())
    .map((x) => {
      const cost = num(x.price);
      const price = cost * (1 + margin);
      return { ...x, cost, profit: price - cost, price, vatAmount: price * vat, priceInclVat: price * (1 + vat) };
    });
  return { margin, vat, items };
}
