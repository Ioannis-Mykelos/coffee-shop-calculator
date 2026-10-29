// The drinks menu: what each drink costs to make (its recipe, priced from Supplies), what it earns per cup and per
// month, and the price that would reach the owner's target margin. Menu prices include VAT; margins don't.

import { type Drink, type MonthData, num } from "./expenses";

export interface DrinkFigures {
  id: string;
  name: string;
  lines: { id: string; supplyId: string; label: string; unit: string; qty: number; cost: number }[];
  /** Ingredients, per cup */
  cost: number;
  /** Menu price, VAT included */
  price: number;
  /** Price without VAT */
  net: number;
  /** What one cup leaves after VAT and ingredients */
  margin: number;
  /** margin ÷ net, or 0 without a price */
  marginPct: number;
  cups: number;
  /** margin × cups sold a month */
  monthly: number;
  /** The price (VAT included) that reaches the target margin; 0 when there's no cost or no reachable target */
  targetPrice: number;
  /** Whether the plant milk option applies to this drink (it has the milk it replaces) */
  hasMilk: boolean;
}

/** VAT and target margin as fractions. */
export function menuRates(m: MonthData) {
  return {
    vat: Math.max(num(m.menu.vat), 0) / 100,
    target: Math.min(Math.max(num(m.menu.target), 0), 95) / 100,
  };
}

/** Whether the plant milk option is set up: both supplies picked and still on the Supplies list. */
export function plantMilkReady(m: MonthData) {
  const { milkId, plantId } = m.menu.plantMilk;
  return !!milkId && !!plantId && milkId !== plantId && [milkId, plantId].every((id) => m.supplies.some((s) => s.id === id));
}

/** One drink's figures; with `plant`, made with plant milk and priced with its surcharge. */
export function drinkFigures(m: MonthData, d: Drink, plant = false): DrinkFigures {
  const { vat, target } = menuRates(m);
  const { milkId, plantId, surcharge } = m.menu.plantMilk;
  const hasMilk = plantMilkReady(m) && d.recipe.some((r) => r.supplyId === milkId);
  const swap = plant && hasMilk;
  const lines = d.recipe.map((r) => {
    const supplyId = swap && r.supplyId === milkId ? plantId : r.supplyId;
    const s = m.supplies.find((x) => x.id === supplyId);
    const qty = num(r.qty);
    return { id: r.id, supplyId, label: s?.label.trim() || "Pick a supply", unit: s?.unit ?? "", qty, cost: s ? qty * num(s.price) : 0 };
  });
  const cost = lines.reduce((a, l) => a + l.cost, 0);
  const price = num(d.price) + (swap ? num(surcharge) : 0);
  const net = price / (1 + vat);
  const margin = net - cost;
  const cups = Math.max(num(d.cups), 0);
  return {
    id: d.id,
    name: d.name.trim() || "Untitled drink",
    lines,
    cost,
    price,
    net,
    margin,
    marginPct: net > 0 ? margin / net : 0,
    cups,
    monthly: margin * cups,
    targetPrice: cost > 0 && target < 1 ? (cost / (1 - target)) * (1 + vat) : 0,
    hasMilk,
  };
}

/**
 * Every drink, the best earners first: by profit a month when cups sold are known, else by margin per cup. Plus the
 * month's totals across the menu.
 */
export function menuSummary(m: MonthData, plant = false) {
  const drinks = m.menu.drinks.map((d) => drinkFigures(m, d, plant));
  const withCups = drinks.some((d) => d.cups > 0);
  drinks.sort((a, b) => (withCups ? b.monthly - a.monthly : 0) || b.margin - a.margin);
  const priced = drinks.filter((d) => d.price > 0);
  const cups = drinks.reduce((a, d) => a + d.cups, 0);
  const profit = drinks.reduce((a, d) => a + d.monthly, 0);
  const sales = drinks.reduce((a, d) => a + d.net * d.cups, 0);
  return {
    drinks,
    withCups,
    /** The drink that earns the most (per month, or per cup without cups sold) */
    best: priced[0] ?? null,
    /** The priced drink with the smallest margin per cup */
    thinnest: priced.length > 1 ? priced.reduce((a, d) => (d.margin < a.margin ? d : a)) : null,
    cups,
    /** Margin left a month by all drinks, after VAT and ingredients */
    profit,
    /** Drink sales a month, VAT excluded */
    sales,
    /** Average margin per cup sold */
    perCup: cups > 0 ? profit / cups : 0,
  };
}
