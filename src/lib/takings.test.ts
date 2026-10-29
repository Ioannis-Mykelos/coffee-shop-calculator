import { describe, expect, it } from "vitest";
import { type MonthData, withDefaults } from "./expenses";
import { daysInMonth, takingsSummary, weekday } from "./takings";

/** Costs 2,500 a month over 25 opening days; one espresso at 2.50 with 25% VAT. */
function month(takings: Record<string, string> = {}): MonthData {
  return withDefaults({
    premises: [{ id: "p", label: "Rent", amount: "2500" }],
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
    menu: {
      drinks: [{ id: "e", kind: "drink", name: "Espresso", price: "2.50", vat: "", cups: "", recipe: [] }],
      vat: "25",
      foodVat: "",
      target: "70",
      plantMilk: { milkId: "", plantId: "", surcharge: "" },
    },
  });
}

describe("the calendar", () => {
  it("knows each month's length and weekdays, Monday first", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-10")).toBe(31);
    expect(weekday("2026-10", 1)).toBe(3); // Thursday
    expect(weekday("2026-10", 5)).toBe(0); // Monday
  });
});

describe("takingsSummary", () => {
  it("sets a daily target with VAT on top, from the month's costs", () => {
    const t = takingsSummary(month(), 2500, "2026-10");
    expect(t.vat).toBeCloseTo(0.25);
    expect(t.needed).toBeCloseTo(3125);
    expect(t.target).toBeCloseTo(125);
    expect(t.days).toHaveLength(31);
    expect(t).toMatchObject({ logged: 0, taken: 0, left: 25, pace: 0 });
    expect(t.perDayLeft).toBeCloseTo(125);
  });

  it("counts the days in, a 0 included, and what each day left must take", () => {
    const t = takingsSummary(month({ 1: "150", 2: "100", 3: "0" }), 2500, "2026-10");
    expect(t).toMatchObject({ logged: 3, taken: 250, good: 1, left: 22 });
    expect(t.takenNet).toBeCloseTo(200);
    expect(t.short).toBeCloseTo(2875);
    expect(t.perDayLeft).toBeCloseTo(2875 / 22);
    expect(t.pace).toBeCloseTo((250 / 3) * 25);
    expect(t.byWeekday[3]).toMatchObject({ label: "Thu", days: 1, average: 150 });
    expect(t.byWeekday[5]).toMatchObject({ label: "Sat", days: 1, average: 0 });
    expect(t.byWeekday[0].days).toBe(0);
  });

  it("is covered once the takings reach what's needed", () => {
    const t = takingsSummary(month({ 1: "2,000", 2: "1.200" }), 2500, "2026-10");
    expect(t.taken).toBe(3200);
    expect(t.short).toBe(0);
    expect(t.perDayLeft).toBe(0);
  });

  it("caps the opening days at the month's length", () => {
    const m = { ...month(), days: "31" };
    expect(takingsSummary(m, 2500, "2026-02").openDays).toBe(28);
    expect(takingsSummary({ ...m, days: "" }, 2500, "2026-02").openDays).toBe(28);
  });
});
