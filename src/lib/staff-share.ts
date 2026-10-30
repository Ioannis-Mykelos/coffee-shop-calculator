// Staff cost as a share of the month's sales: the first number most café owners are told to watch.

import { type MonthData, computeTotals, profitOf } from "./expenses";

/** A healthy share for a café, as fractions: a rule of thumb, not a law. */
export const STAFF_RANGE = { low: 0.25, high: 0.35 } as const;

export type StaffShareStatus = "low" | "healthy" | "high";

/** Staff cost, sales excl. VAT and the one as a share of the other; null until there are both. */
export function staffShare(m: MonthData) {
  const totals = computeTotals(m);
  const sales = profitOf(m, totals.total)?.revenue ?? 0;
  if (totals.staff <= 0 || sales <= 0) return null;
  const share = totals.staff / sales;
  const status: StaffShareStatus = share < STAFF_RANGE.low ? "low" : share > STAFF_RANGE.high ? "high" : "healthy";
  return { staff: totals.staff, sales, share, status };
}
