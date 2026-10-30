// A workspace: everything one owner has entered (every month's figures, the month they're on, the currency and the
// country they picked). Saved in the browser in local mode, and in the owner's account otherwise (app/api/workspace).
// Shared by the browser and the server, so the server checks what it's sent with the same rules the app saves by.

import { type Currency, isCurrency, type MenuSettings, type MonthData, type MonthsData, withDefaults } from "./expenses";
import { HISTORY_LIMIT } from "./price-history";

export interface Workspace {
  month: string;
  data: MonthsData;
  currency: Currency;
  /** Country the owner picked by hand (e.g. when on a VPN); overrides the detected one. */
  country?: string;
}

/** Bounds on what one workspace may hold, so a request can't fill the database. */
export const LIMITS = {
  /** 20 years of months */
  months: 240,
  /** Items in one list (rent lines, supplies, staff rows…) */
  items: 200,
  /** Characters in a label */
  text: 120,
  /** Characters in a typed amount */
  amount: 24,
  /** Bytes of JSON in one save */
  bytes: 2_000_000,
} as const;

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const COUNTRY = /^[A-Z]{2}$/;
const DAY = /^([1-9]|[12]\d|3[01])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number = LIMITS.text) => (typeof v === "string" ? v.slice(0, max) : "");
const amount = (v: unknown) => text(v, LIMITS.amount);
const id = (v: unknown) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : "");

/** Each element of `v` through `item`, up to the item limit; anything without an id is dropped. */
function list<T extends { id: string }>(v: unknown, item: (x: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, LIMITS.items).filter(isRecord).map(item).filter((x) => x.id);
}

const lineItems = (v: unknown) => list(v, (x) => ({ id: id(x.id), label: text(x.label), amount: amount(x.amount) }));
/** A supply's price changes, or nothing when it has none, so unchanged items are saved as they were. */
function priceHistory(v: unknown) {
  if (!Array.isArray(v)) return {};
  const changes = v
    .filter(isRecord)
    .filter((x) => typeof x.date === "string" && DATE.test(x.date))
    .map((x) => ({ date: x.date as string, from: amount(x.from), to: amount(x.to) }))
    .slice(-HISTORY_LIMIT);
  return changes.length ? { priceHistory: changes } : {};
}
const supplyItems = (v: unknown) =>
  list(v, (x) => ({ id: id(x.id), label: text(x.label), qty: amount(x.qty), unit: text(x.unit, 20), price: amount(x.price), ...priceHistory(x.priceHistory) }));
const recipe = (v: unknown) => list(v, (x) => ({ id: id(x.id), supplyId: id(x.supplyId), qty: amount(x.qty) }));

/** The menu, or undefined when the month has none yet (withDefaults then makes one from the cup recipe). */
function menu(v: unknown): MenuSettings | undefined {
  if (!isRecord(v) || !Array.isArray(v.drinks)) return undefined;
  return {
    drinks: list(v.drinks, (x) => ({
      id: id(x.id),
      kind: x.kind === "food" ? ("food" as const) : ("drink" as const),
      name: text(x.name),
      price: amount(x.price),
      vat: amount(x.vat),
      cups: amount(x.cups),
      recipe: recipe(x.recipe),
    })),
    vat: amount(v.vat),
    foodVat: amount(v.foodVat),
    target: amount(v.target),
  };
}

/** Each day's takings, keyed by day of the month; days with nothing typed are dropped. */
function takings(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([k, x]) => DAY.test(k) && typeof x === "string" && x.trim()).map(([k, x]) => [k, amount(x)]));
}

/** One month, keeping only known fields of the right type; fields added since it was saved are filled in. */
export function cleanMonth(v: unknown): MonthData | null {
  if (!isRecord(v)) return null;
  const cup = isRecord(v.cup) ? v.cup : {};
  const pricing = isRecord(v.consumablePricing) ? v.consumablePricing : {};
  return withDefaults({
    premises: lineItems(v.premises),
    utilities: lineItems(v.utilities),
    other: lineItems(v.other),
    supplies: supplyItems(v.supplies),
    consumables: supplyItems(v.consumables),
    staff: list(v.staff, (x) => ({
      id: id(x.id),
      role: text(x.role),
      type: x.type === "PT" ? ("PT" as const) : ("FT" as const),
      count: amount(x.count),
      hours: amount(x.hours),
      rate: amount(x.rate),
      ins: amount(x.ins),
    })),
    days: amount(v.days),
    coffeesPerCustomer: amount(v.coffeesPerCustomer),
    foodPerCustomer: amount(v.foodPerCustomer),
    extrasPerCustomer: amount(v.extrasPerCustomer),
    revenue: amount(v.revenue),
    takings: takings(v.takings),
    cup: { recipe: recipe(cup.recipe), margin: amount(cup.margin), vat: amount(cup.vat) },
    consumablePricing: { margin: amount(pricing.margin), vat: amount(pricing.vat) },
    menu: menu(v.menu),
  });
}

/** A workspace as sent by a browser, cleaned up, or null if it isn't one. */
export function cleanWorkspace(v: unknown): Workspace | null {
  if (!isRecord(v) || !isRecord(v.data) || typeof v.month !== "string" || !MONTH_KEY.test(v.month)) return null;
  const entries = Object.entries(v.data).filter(([k]) => MONTH_KEY.test(k));
  if (entries.length > LIMITS.months) return null;
  const data: MonthsData = {};
  for (const [k, m] of entries) {
    const month = cleanMonth(m);
    if (month) data[k] = month;
  }
  if (!data[v.month]) return null;
  return {
    month: v.month,
    data,
    currency: isCurrency(v.currency) ? v.currency : "EUR",
    ...(typeof v.country === "string" && COUNTRY.test(v.country) && { country: v.country }),
  };
}
