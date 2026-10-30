// What a supply's latest price change did to the menu: "Milk up 12%: Caffè latte margin is now 58%".

import { type MonthData } from "./expenses";
import { drinkFigures, ingredients, menuRates } from "./menu";
import { lastPriceChange, percentLabel } from "./price-history";

export interface PriceImpact {
  label: string;
  /** The change in % of the old price; negative when it went down */
  percent: number;
  /** Priced menu items made with it, the lowest margin first */
  items: { id: string; name: string; marginPct: number; marginBefore: number; belowTarget: boolean }[];
}

/** The latest price change of a supply or consumable and the menu items it touches; null if there's nothing to say. */
export function priceImpact(m: MonthData, supplyId: string): PriceImpact | null {
  const supply = ingredients(m).find((s) => s.id === supplyId);
  const change = supply && lastPriceChange(supply);
  if (!supply || !change) return null;

  // The same month with the old price, to compare with. Only the copy changes.
  const atOldPrice: MonthData = {
    ...m,
    supplies: m.supplies.map((s) => (s.id === supplyId ? { ...s, price: change.from } : s)),
    consumables: m.consumables.map((s) => (s.id === supplyId ? { ...s, price: change.from } : s)),
  };
  const { target } = menuRates(m);
  const items = m.menu.drinks
    .filter((d) => d.recipe.some((r) => r.supplyId === supplyId))
    .map((d) => ({ now: drinkFigures(m, d), before: drinkFigures(atOldPrice, d) }))
    .filter(({ now }) => now.price > 0)
    .map(({ now, before }) => ({
      id: now.id,
      name: now.name,
      marginPct: now.marginPct,
      marginBefore: before.marginPct,
      belowTarget: now.marginPct < target,
    }))
    .sort((a, b) => a.marginPct - b.marginPct);

  return items.length ? { label: supply.label.trim() || "This item", percent: change.percent, items } : null;
}

/** "Milk up 12%: Caffè latte margin is now 58%, Cappuccino 61%" */
export function impactSentence({ label, percent, items }: PriceImpact) {
  const margins = items.map((it, i) => `${it.name}${i ? "" : " margin is now"} ${Math.round(it.marginPct * 100)}%`);
  return `${label} ${percent > 0 ? "up" : "down"} ${percentLabel(percent)}: ${margins.join(", ")}`;
}
