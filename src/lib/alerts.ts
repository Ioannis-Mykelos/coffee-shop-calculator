// The warnings for a month, each from one rule. Plain functions of the figures, so the app, the weekly email and the
// tests all get the same answers. A rule with nothing to say, or not enough to go on, stays quiet.

import { type MonthData, type MonthsData, computeTotals, monthKey, shiftMonth } from "./expenses";
import { drinkFigures, menuRates } from "./menu";
import { STAFF_RANGE, staffShare } from "./staff-share";
import { takingsSummary } from "./takings";

/** Costs have to rise by more than this on last month to warn */
export const COST_RISE = 0.1;
/** Wednesday, with Monday as 0: from here on, the week so far says something */
const MIDWEEK = 2;

export type AlertRule = "margin" | "behind" | "costs" | "staff";

export interface Alert {
  /** The same warning keeps the same id, so dismissing it lasts */
  id: string;
  rule: AlertRule;
  title: string;
  detail: string;
}

type Fmt = (n: number) => string;
const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** Each priced drink below the menu's target margin. No target, no warning. */
function marginAlerts(m: MonthData): Alert[] {
  const { target } = menuRates(m);
  if (target <= 0) return [];
  return m.menu.drinks
    .filter((d) => d.kind !== "food")
    .map((d) => drinkFigures(m, d))
    .filter((d) => d.price > 0 && d.marginPct < target)
    .map((d) => ({
      id: `margin:${d.id}`,
      rule: "margin",
      title: `${d.name} is below your target margin`,
      detail: `It keeps ${percent(d.marginPct)} against your ${percent(target)} target.`,
    }));
}

/** From Wednesday on: this week's logged days, in this month, against the daily target. */
function behindAlert(m: MonthData, key: string, now: Date, fmt: Fmt): Alert[] {
  const today = now.getDate();
  const day = (now.getDay() + 6) % 7;
  if (key !== monthKey(now) || day < MIDWEEK) return [];
  const monday = today - day;
  const { days, target } = takingsSummary(m, computeTotals(m).total, key);
  const week = days.filter((d) => d.logged && d.day >= monday && d.day <= today);
  if (!week.length || target <= 0) return [];
  const short = target * week.length - week.reduce((a, d) => a + d.amount, 0);
  if (short <= 0) return [];
  return [
    {
      id: `behind:${key}-${monday}`,
      rule: "behind",
      title: "This week is behind the daily target",
      detail: `${fmt(short)} short after ${week.length} ${week.length === 1 ? "day" : "days"}, against ${fmt(target)} a day.`,
    },
  ];
}

/** Costs up by more than COST_RISE on the month before, when there's a month before to compare with. */
function costsAlert(data: MonthsData, key: string, fmt: Fmt): Alert[] {
  const prevKey = shiftMonth(key, -1);
  const before = data[prevKey] ? computeTotals(data[prevKey]).total : 0;
  const now = computeTotals(data[key]).total;
  if (before <= 0 || now <= before * (1 + COST_RISE)) return [];
  return [
    {
      id: "costs",
      rule: "costs",
      title: `Costs are up ${percent(now / before - 1)} on last month`,
      detail: `${fmt(now)} this month against ${fmt(before)} last month.`,
    },
  ];
}

/** Staff cost above the healthy share of sales. */
function staffAlert(m: MonthData): Alert[] {
  const r = staffShare(m);
  if (r?.status !== "high") return [];
  return [
    {
      id: "staff",
      rule: "staff",
      title: "Staff cost is high",
      detail: `It takes ${percent(r.share)} of sales; cafés usually run at ${percent(STAFF_RANGE.low)}–${percent(STAFF_RANGE.high)}.`,
    },
  ];
}

/** Every warning for the month `key` as it stands at `now`. */
export function monthAlerts(data: MonthsData, key: string, now: Date, fmt: Fmt): Alert[] {
  const m = data[key];
  if (!m) return [];
  return [...behindAlert(m, key, now, fmt), ...costsAlert(data, key, fmt), ...staffAlert(m), ...marginAlerts(m)];
}
