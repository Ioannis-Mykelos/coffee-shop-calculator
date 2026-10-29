import { describe, expect, it } from "vitest";
import { type MonthData, withDefaults } from "./expenses";
import { NO_CHANGES, hourlyStaffCost, whatIf } from "./what-if";

/** Costs 2,700 a month; takes 3,000 (1,500 espressos at 2.50 with 25% VAT); break-even at 54 customers a day. */
function month(patch: Partial<MonthData> = {}): MonthData {
  return withDefaults({
    premises: [{ id: "p", label: "Rent", amount: "1000" }],
    utilities: [{ id: "u", label: "Power", amount: "200" }],
    other: [{ id: "o", label: "Cleaning", amount: "100" }],
    supplies: [
      { id: "b", label: "Coffee beans", qty: "10", unit: "kg", price: "20" },
      { id: "m", label: "Milk", qty: "100", unit: "L", price: "1" },
      { id: "c", label: "To-go cups", qty: "1000", unit: "pcs", price: "0.10" },
    ],
    consumables: [],
    staff: [{ id: "s", role: "Barista", type: "PT", count: "1", hours: "100", rate: "10", ins: "0" }],
    days: "25",
    coffeesPerCustomer: "1",
    extrasPerCustomer: "",
    revenue: "3000",
    // Cup price 2.00 + 25% VAT = 2.50
    cup: { recipe: [{ id: "r", supplyId: "b", qty: "0.02" }, { id: "r2", supplyId: "c", qty: "1" }], margin: "300", vat: "25" },
    consumablePricing: { margin: "0", vat: "" },
    menu: {
      drinks: [{ id: "e", name: "Espresso", price: "2.50", vat: "", cups: "1500", recipe: [] }],
      vat: "25",
      target: "70",
      plantMilk: { milkId: "", plantId: "", surcharge: "" },
    },
    ...patch,
  });
}

describe("whatIf", () => {
  it("changes nothing without a change", () => {
    const r = whatIf(month(), NO_CHANGES);
    expect(r.before).toEqual(r.after);
    expect(r.before).toMatchObject({ costs: 2700, sales: 3000, profit: 300, customersDay: 54 });
    expect(r.keep).toBeNull();
  });

  it("raises the bean Supplies, and says what keeps today's profit", () => {
    const r = whatIf(month(), { ...NO_CHANGES, beans: 50 });
    expect(r.after.costs).toBeCloseTo(2800); // beans 200 → 300; cups aren't beans
    expect(r.gap).toBeCloseTo(100);
    // 100 ÷ (1,500 cups × 2.00) = 3.3% → 4%; 100 ÷ 2.00 a customer ÷ 25 days → 2 a day
    expect(r.keep).toEqual({ pricePct: 4, customersDay: 2 });
  });

  it("costs extra staff hours at the café's own hourly rate", () => {
    expect(hourlyStaffCost(month())).toBe(10);
    const r = whatIf(month(), { ...NO_CHANGES, hours: 10 });
    expect(r.after.parts.staff).toBeCloseTo(1000 + (10 * 52 * 10) / 12);
  });

  it("scales rent, and Supplies with the cups sold", () => {
    expect(whatIf(month(), { ...NO_CHANGES, rent: 10 }).after.parts.premises).toBeCloseTo(1100);
    const r = whatIf(month(), { ...NO_CHANGES, sales: -20 });
    expect(r.after.parts.ingredients).toBeCloseTo(320);
    expect(r.after.sales).toBeCloseTo(2400);
    expect(r.after.profit).toBeCloseTo(-220);
  });

  it("moves sales and break-even with drink prices", () => {
    const r = whatIf(month(), { ...NO_CHANGES, price: 10 });
    expect(r.after.sales).toBeCloseTo(3300); // + 1,500 cups × 0.20
    expect(r.after.customersDay).toBe(50); // 2,700 ÷ 2.20 ÷ 25 = 49.1
    expect(r.keep).toBeNull();
  });

  it("estimates sales from the menu without takings, and works back cups from takings without a menu", () => {
    expect(whatIf(month({ revenue: "" }), NO_CHANGES)).toMatchObject({ salesSource: "menu", before: { sales: 3000 } });
    const noCups = { ...month().menu, drinks: [{ ...month().menu.drinks[0], cups: "" }] };
    expect(whatIf(month({ menu: noCups }), NO_CHANGES)).toMatchObject({ salesSource: "takings", cups: 1500 });
    const neither = whatIf(month({ revenue: "", menu: noCups }), { ...NO_CHANGES, beans: 50 });
    expect(neither).toMatchObject({ salesSource: null, after: { sales: null, profit: null }, keep: null });
  });
});
