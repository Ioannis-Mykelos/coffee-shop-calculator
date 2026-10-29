// Daily takings: the till's total each day, VAT included, against what the month needs to cover its costs. Costs are
// without VAT, so what's needed is grossed up by the average VAT on a customer's sale (drinks and extras, each at its
// own rate) to compare with the till.

import { type MonthData, breakEven, monthDate, num } from "./expenses";

/** Monday first, as the calendar shows them */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function daysInMonth(key: string) {
  const d = monthDate(key);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** The weekday of a day of the month, 0 = Monday. */
export function weekday(key: string, day: number) {
  const d = monthDate(key);
  return (new Date(d.getFullYear(), d.getMonth(), day).getDay() + 6) % 7;
}

/** Whether a day's takings have been typed in (a 0 counts: the café was open and sold nothing). */
export const logged = (m: Pick<MonthData, "takings">, day: number) => String(m.takings[day] ?? "").trim() !== "";

export function takingsSummary(m: MonthData, total: number, key: string) {
  const be = breakEven(m, total);
  /** The average VAT on a sale, as a fraction */
  const vat = be.avg > 0 ? be.avgGross / be.avg - 1 : Math.max(num(m.menu.vat), 0) / 100;
  const inMonth = daysInMonth(key);
  const openDays = Math.min(num(m.days) || inMonth, inMonth);
  /** What the till must take this month to cover the costs, VAT included */
  const needed = total * (1 + vat);
  const target = openDays > 0 ? needed / openDays : 0;
  const days = Array.from({ length: inMonth }, (_, i) => {
    const day = i + 1;
    const amount = num(m.takings[day]);
    return { day, weekday: weekday(key, day), logged: logged(m, day), amount };
  });
  const entered = days.filter((d) => d.logged);
  const taken = entered.reduce((a, d) => a + d.amount, 0);
  const left = Math.max(openDays - entered.length, 0);
  const short = Math.max(needed - taken, 0);
  const byWeekday = WEEKDAYS.map((label, i) => {
    const on = entered.filter((d) => d.weekday === i);
    return { label, days: on.length, average: on.length ? on.reduce((a, d) => a + d.amount, 0) / on.length : 0 };
  });
  return {
    days,
    vat,
    openDays,
    needed,
    /** A day's share of what's needed, VAT included */
    target,
    taken,
    /** Taken so far without VAT, comparable with the month's sales */
    takenNet: taken / (1 + vat),
    logged: entered.length,
    /** Days at or above the daily target */
    good: entered.filter((d) => d.amount >= target).length,
    left,
    short,
    /** What each open day left must take to still break even; 0 once covered or with no days left */
    perDayLeft: left > 0 ? short / left : 0,
    /** What the month is heading for at today's daily average, VAT included */
    pace: entered.length ? (taken / entered.length) * openDays : 0,
    byWeekday,
  };
}
