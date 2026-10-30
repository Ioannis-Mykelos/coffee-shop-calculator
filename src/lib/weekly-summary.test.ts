import { describe, expect, it } from "vitest";
import { type MonthData, currencyFormatter, withDefaults } from "./expenses";
import { lastMonday, weeklySummary } from "./weekly-summary";

const fmt = currencyFormatter("EUR");

/** `amount` of costs over 25 opening days at 25% VAT, so the daily target is amount ÷ 20. */
function month(takings: Record<string, string>, amount = "2500"): MonthData {
  return withDefaults({
    premises: [{ id: "p", label: "Rent", amount }],
    utilities: [],
    supplies: [],
    consumables: [],
    staff: [],
    other: [],
    days: "25",
    coffeesPerCustomer: "1",
    extrasPerCustomer: "",
    revenue: "",
    takings,
    cup: { recipe: [], margin: "0", vat: "" },
    consumablePricing: { margin: "0", vat: "" },
    menu: { drinks: [{ id: "e", kind: "drink", name: "Espresso", price: "2.50", vat: "", cups: "", recipe: [] }], vat: "25", foodVat: "", target: "" },
  });
}

/** 12 October 2026 is a Monday */
const MONDAY = new Date(2026, 9, 12);

describe("lastMonday", () => {
  it("is the Monday of the week before, on any day of this one", () => {
    expect(lastMonday(new Date(2026, 9, 19, 6))).toEqual(MONDAY);
    expect(lastMonday(new Date(2026, 9, 25, 23))).toEqual(MONDAY);
  });

  it("crosses into the month before", () => {
    expect(lastMonday(new Date(2026, 10, 2))).toEqual(new Date(2026, 9, 26));
  });
});

describe("weeklySummary", () => {
  it("tells the week: sales, best and worst day, and how far from target", () => {
    const s = weeklySummary({ "2026-10": month({ 12: "100", 13: "150", 14: "120", 15: "130", 16: "200", 17: "80", 18: "70" }) }, MONDAY, fmt)!;
    expect(s.range).toBe("12–18 October");
    expect(s.days).toHaveLength(7);
    expect(s.sales).toBe(850);
    expect(s.target).toBeCloseTo(875);
    expect(s.gap).toBeCloseTo(-25);
    expect(s.best).toEqual({ label: "Friday 16 October", amount: 200 });
    expect(s.worst).toEqual({ label: "Sunday 18 October", amount: 70 });
  });

  it("is ahead when the till beat the target", () => {
    expect(weeklySummary({ "2026-10": month({ 12: "500" }) }, MONDAY, fmt)!.gap).toBeCloseTo(375);
  });

  it("only counts days with takings against the target, and a 0 is a day", () => {
    const s = weeklySummary({ "2026-10": month({ 12: "100", 13: "0" }) }, MONDAY, fmt)!;
    expect(s.days).toHaveLength(2);
    expect(s.target).toBeCloseTo(250);
    expect(s.worst?.amount).toBe(0);
  });

  it("has no worst day with only one day", () => {
    const s = weeklySummary({ "2026-10": month({ 14: "100" }) }, MONDAY, fmt)!;
    expect(s.best.label).toBe("Wednesday 14 October");
    expect(s.worst).toBeNull();
  });

  it("is null with no takings that week, or no month at all", () => {
    expect(weeklySummary({ "2026-10": month({ 5: "100" }) }, MONDAY, fmt)).toBeNull();
    expect(weeklySummary({}, MONDAY, fmt)).toBeNull();
  });

  describe("a week across two months", () => {
    // 28 September 2026 is a Monday; the week ends on Sunday 4 October.
    const start = new Date(2026, 8, 28);
    const data = {
      "2026-09": month({ 29: "100", 30: "300" }, "2500"),
      "2026-10": month({ 1: "50", 3: "200" }, "5000"),
    };

    it("reads each day from its own month, at that month's target", () => {
      const s = weeklySummary(data, start, fmt)!;
      expect(s.range).toBe("28 September – 4 October");
      expect(s.sales).toBe(650);
      // Two days at 125 and two at 250
      expect(s.target).toBeCloseTo(750);
      expect(s.gap).toBeCloseTo(-100);
      expect(s.best.label).toBe("Wednesday 30 September");
      expect(s.worst?.label).toBe("Thursday 1 October");
    });

    it("works with only one of the months saved", () => {
      const s = weeklySummary({ "2026-10": data["2026-10"] }, start, fmt)!;
      expect(s.days).toHaveLength(2);
      expect(s.sales).toBe(250);
    });
  });

  describe("the week's alerts", () => {
    it("includes the week's own, as things stood on its Sunday", () => {
      const s = weeklySummary({ "2026-10": month({ 12: "100", 13: "100", 14: "100" }) }, MONDAY, fmt)!;
      expect(s.alerts.map((a) => a.id)).toEqual(["behind:2026-10-12"]);
    });

    it("is empty for a good week", () => {
      expect(weeklySummary({ "2026-10": month({ 12: "500" }) }, MONDAY, fmt)!.alerts).toEqual([]);
    });

    it("keeps one of an alert that both months raise, the later month's", () => {
      const s = weeklySummary(
        {
          "2026-08": month({}, "1000"),
          "2026-09": month({ 29: "100" }, "2000"),
          "2026-10": month({ 1: "100" }, "4000"),
        },
        new Date(2026, 8, 28),
        fmt,
      )!;
      const costs = s.alerts.filter((a) => a.rule === "costs");
      expect(costs).toHaveLength(1);
      expect(costs[0].detail).toContain(fmt(4000));
    });

    it("leaves out a dismissed alert, and the later month's dismissal covers both", () => {
      const data = { "2026-09": month({ 29: "100" }), "2026-10": month({ 1: "100" }, "4000") };
      const week = new Date(2026, 8, 28);
      const costs = (dismissed: string[]) => weeklySummary({ "2026-08": month({}, "1000"), ...data }, week, fmt, dismissed)!.alerts.filter((a) => a.rule === "costs");
      expect(costs([])).toHaveLength(1);
      expect(costs(["2026-10:costs"])).toHaveLength(0);
      expect(costs(["2026-09:costs"])).toHaveLength(1);
    });
  });
});
