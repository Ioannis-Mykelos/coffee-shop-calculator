// What a supply used to cost. Each item carries its own history, so it follows the item into every new month.

import { type PriceChange, type SupplyItem, num } from "./expenses";

/** Changes kept per item; the oldest go first. */
export const HISTORY_LIMIT = 24;

/** Today, or any date, as saved in a price change: "2026-10-30" in the owner's own time zone. */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Notes that an item's price went `from` → `to` on `date`, once the owner has finished typing it. A first price or a
 * cleared field isn't a change. Corrections on one day count as one change, and undoing it leaves no trace.
 */
export function recordPriceChange(item: SupplyItem, from: string, to: string, date: string) {
  if (!num(from) || !num(to) || num(from) === num(to)) return;
  const history = item.priceHistory ?? [];
  const today = history.at(-1)?.date === date ? history.at(-1) : undefined;
  const earlier = today ? history.slice(0, -1) : history;
  const start = today?.from ?? from;
  const next = num(start) === num(to) ? earlier : [...earlier, { date, from: start, to }];
  item.priceHistory = next.slice(-HISTORY_LIMIT);
}

/** A change's size for showing: "12%", or "4.5%" under 10%, without its sign. */
export function percentLabel(percent: number) {
  const size = Math.abs(percent);
  return `${size < 10 ? Math.round(size * 10) / 10 : Math.round(size)}%`;
}

/** The latest change as a % of the old price, or null if the price has never changed. */
export function lastPriceChange(item: SupplyItem): (PriceChange & { percent: number }) | null {
  const last = item.priceHistory?.at(-1);
  if (!last || !num(last.from)) return null;
  return { ...last, percent: ((num(last.to) - num(last.from)) / num(last.from)) * 100 };
}
