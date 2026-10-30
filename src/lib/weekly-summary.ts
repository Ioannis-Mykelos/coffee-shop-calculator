// Last week's story, from the daily takings: what the till took, the best and worst day, how far from the target, and
// the week's alerts. A week can run across two months, so each day is read from its own month, with that month's target.

import { type Alert, monthAlerts } from "./alerts";
import { type MonthsData, computeTotals, monthKey } from "./expenses";
import { takingsSummary } from "./takings";

type Fmt = (n: number) => string;

export interface WeekDay {
  /** "Monday 12 October" */
  label: string;
  /** The till's total, VAT included */
  amount: number;
}

export interface WeeklySummary {
  /** "12–18 October", or "28 September – 4 October" across two months */
  range: string;
  /** Days with takings typed in */
  days: WeekDay[];
  /** The till's total over those days, VAT included */
  sales: number;
  /** What those days needed to take */
  target: number;
  /** sales − target: positive is ahead */
  gap: number;
  best: WeekDay;
  /** Null with only one day: it can't be both */
  worst: WeekDay | null;
  alerts: Alert[];
}

const dateOf = (d: Date, fields: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", fields);

/** Monday of the last full week before `now`. */
export function lastMonday(now: Date) {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday - 7);
}

function rangeLabel(monday: Date, sunday: Date) {
  const sameMonth = monday.getMonth() === sunday.getMonth();
  return sameMonth
    ? `${monday.getDate()}–${dateOf(sunday, { day: "numeric", month: "long" })}`
    : `${dateOf(monday, { day: "numeric", month: "long" })} – ${dateOf(sunday, { day: "numeric", month: "long" })}`;
}

/** Each month's alerts as they stood when the week left it. The later month's copy of a repeated alert wins. */
function weekAlerts(data: MonthsData, week: Date[], fmt: Fmt) {
  const lastDayIn = new Map(week.map((d) => [monthKey(d), d]));
  const alerts = new Map<string, Alert>();
  for (const [key, day] of lastDayIn) for (const a of monthAlerts(data, key, day, fmt)) alerts.set(a.id, a);
  return [...alerts.values()];
}

/** The week starting on `monday`, or null if no day of it has takings: there's no story to tell. */
export function weeklySummary(data: MonthsData, monday: Date, fmt: Fmt): WeeklySummary | null {
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const days: WeekDay[] = [];
  let target = 0;
  for (const date of week) {
    const key = monthKey(date);
    const m = data[key];
    const day = m && takingsSummary(m, computeTotals(m).total, key);
    const entry = day?.days[date.getDate() - 1];
    if (!day || !entry?.logged) continue;
    days.push({ label: dateOf(date, { weekday: "long", day: "numeric", month: "long" }), amount: entry.amount });
    target += day.target;
  }
  if (!days.length) return null;

  const sales = days.reduce((a, d) => a + d.amount, 0);
  const best = days.reduce((a, d) => (d.amount > a.amount ? d : a));
  const worst = days.reduce((a, d) => (d.amount < a.amount ? d : a));
  return {
    range: rangeLabel(week[0], week[6]),
    days,
    sales,
    target,
    gap: sales - target,
    best,
    worst: days.length > 1 ? worst : null,
    alerts: weekAlerts(data, week, fmt),
  };
}
