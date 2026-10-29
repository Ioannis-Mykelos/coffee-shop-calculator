// "What if": a change tried on this month's figures, nothing saved. Bean and milk prices scale those Supplies, rent
// scales Rent & premises, extra staff hours cost the café's own average hour, drink prices move sales per cup sold,
// and cups sold move sales along with Supplies and Consumables (bought in step with what's sold).

import { type MonthData, breakEven, computeTotals, num, staffLine } from "./expenses";
import { menuSummary } from "./menu";

/** Each in % of today, except `hours` (extra staff hours a week). */
export interface Changes {
  beans: number;
  milk: number;
  rent: number;
  hours: number;
  price: number;
  sales: number;
}

export const NO_CHANGES: Changes = { beans: 0, milk: 0, rent: 0, hours: 0, price: 0, sales: 0 };

const WEEKS_PER_MONTH = 52 / 12;

export const isBeans = (label: string) => /bean|coffee/i.test(label) && !/cup|lid|filter|machine/i.test(label);
export const isMilk = (label: string) => /milk/i.test(label);

/** What one staff hour costs with contributions: part-timers' average when there are any (extra hours usually are), else everyone's. */
export function hourlyStaffCost(m: MonthData) {
  const rows = m.staff.filter((x) => num(x.count) > 0 && num(x.hours) > 0);
  const pick = rows.some((x) => x.type === "PT") ? rows.filter((x) => x.type === "PT") : rows;
  const hours = pick.reduce((a, x) => a + num(x.count) * num(x.hours), 0);
  return hours > 0 ? pick.reduce((a, x) => a + staffLine(x).total, 0) / hours : 0;
}

export interface Outcome {
  costs: number;
  /** Sales a month, VAT excluded; null when neither takings nor cups sold are known */
  sales: number | null;
  profit: number | null;
  /** Customers a day to break even */
  customersDay: number;
  parts: { staff: number; premises: number; ingredients: number; running: number };
}

export function whatIf(m: MonthData, c: Changes) {
  const t = computeTotals(m);
  const be = breakEven(m, t.total);
  const menu = menuSummary(m);
  const typed = String(m.revenue ?? "").trim() !== "";
  const salesSource: "takings" | "menu" | null = typed ? "takings" : menu.withCups ? "menu" : null;
  const sales = typed ? num(m.revenue) : menu.withCups ? menu.sales : null;
  // Cups sold a month: the menu's estimate, else worked back from the takings at the break-even average sale.
  const cups = menu.cups > 0 ? menu.cups : typed && be.avg > 0 ? (num(m.revenue) / be.avg) * be.coffees : 0;
  // Average drink price, which a price change scales: without VAT for sales, with it to show the owner.
  const cupNet = menu.cups > 0 ? menu.sales / menu.cups : be.cupPrice / (1 + be.vat);
  const cupPrice = menu.cups > 0 ? menu.drinks.reduce((a, d) => a + d.price * d.cups, 0) / menu.cups : be.cupPrice;
  const ingredients = (beans: number, milk: number, volume: number) =>
    m.supplies.reduce((a, s) => {
      const f = isBeans(s.label) ? 1 + beans / 100 : isMilk(s.label) ? 1 + milk / 100 : 1;
      return a + num(s.qty) * num(s.price) * f;
    }, 0) * volume + t.consumables * volume;
  const outcome = (ch: Changes): Outcome => {
    const salesF = 1 + ch.sales / 100;
    const priceF = ch.price / 100;
    const parts = {
      staff: t.staff + ch.hours * WEEKS_PER_MONTH * hourlyStaffCost(m),
      premises: t.premises * (1 + ch.rent / 100),
      ingredients: ingredients(ch.beans, ch.milk, salesF),
      running: t.utilities + t.other,
    };
    const costs = parts.staff + parts.premises + parts.ingredients + parts.running;
    const s = sales === null ? null : sales * salesF + cups * salesF * cupNet * priceF;
    // A customer's average sale (VAT excluded) moves with the coffee part of it.
    const avg = be.avg + (be.coffeeSpend / (1 + be.vat)) * priceF;
    return {
      costs,
      sales: s,
      profit: s === null ? null : s - costs,
      customersDay: avg > 0 && be.days > 0 ? Math.ceil(costs / avg / be.days) : 0,
      parts,
    };
  };

  const before = outcome(NO_CHANGES);
  const after = outcome(c);
  // What it would take to keep today's profit: a price rise on every drink, or more customers.
  const gap = before.profit !== null && after.profit !== null ? before.profit - after.profit : 0;
  const cupsAfter = cups * (1 + c.sales / 100);
  const avgAfter = be.avg + (be.coffeeSpend / (1 + be.vat)) * (c.price / 100);
  const keep =
    gap > 0.5
      ? {
          /** Rise on every drink price, in % of today's, rounded up to a whole % */
          pricePct: cupsAfter > 0 && cupNet > 0 ? Math.ceil((gap / (cupsAfter * cupNet)) * 100) : null,
          customersDay: avgAfter > 0 && be.days > 0 ? Math.ceil(gap / avgAfter / be.days) : null,
        }
      : null;
  return { before, after, gap, keep, salesSource, cups, hourly: hourlyStaffCost(m), cupPrice };
}
