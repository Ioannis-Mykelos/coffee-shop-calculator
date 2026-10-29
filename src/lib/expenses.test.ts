import { describe, expect, it } from "vitest";
import {
  averageDrink,
  breakEven,
  computeTotals,
  cupCost,
  drinkVat,
  type MonthData,
  monthKey,
  num,
  profitOf,
  sampleMonth,
  shiftMonth,
  staffLine,
  withDefaults,
} from "./expenses";

/** An empty month, with only what a test sets. */
function month(patch: Partial<MonthData> = {}): MonthData {
  return withDefaults({
    premises: [],
    utilities: [],
    supplies: [],
    consumables: [],
    staff: [],
    other: [],
    days: "",
    coffeesPerCustomer: "1",
    extrasPerCustomer: "",
    revenue: "",
    cup: { recipe: [], margin: "0", vat: "" },
    consumablePricing: { margin: "0", vat: "" },
    ...patch,
  });
}

describe("num", () => {
  it.each([
    ["1200.50", 1200.5],
    ["1,200.50", 1200.5],
    ["1 200,50", 1200.5],
    ["1.200,50", 1200.5],
    ["1'200.50", 1200.5],
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["1,200", 1200],
    ["1.500", 1500],
    ["1,234,567", 1234567],
    ["0.018", 0.018],
    ["0,110", 0.11],
    ["22", 22],
    ["", 0],
    ["abc", 0],
  ])("reads %j as %d", (text, expected) => {
    expect(num(text)).toBeCloseTo(expected, 6);
  });

  it("passes numbers through", () => {
    expect(num(3.25)).toBe(3.25);
    expect(num(Number.NaN)).toBe(0);
  });
});

describe("months", () => {
  it("steps across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthKey(new Date(2026, 9, 28))).toBe("2026-10");
  });
});

describe("totals", () => {
  it("adds every category", () => {
    const t = computeTotals(
      month({
        premises: [{ id: "a", label: "Rent", amount: "3,000" }],
        utilities: [{ id: "b", label: "Power", amount: "560" }],
        supplies: [{ id: "c", label: "Cups", qty: "3000", unit: "pcs", price: "0.11" }],
        consumables: [{ id: "d", label: "Juice", qty: "200", unit: "bottles", price: "1.2" }],
        staff: [{ id: "e", role: "Barista", type: "FT", count: "2", hours: "160", rate: "23", ins: "10" }],
        other: [{ id: "f", label: "Fees", amount: "250" }],
      }),
    );
    expect(t).toMatchObject({ premises: 3000, utilities: 560, supplies: 330, consumables: 240, other: 250 });
    expect(t.staff).toBeCloseTo(2 * 160 * 23 * 1.1);
    expect(t.total).toBeCloseTo(3000 + 560 + 330 + 240 + 250 + 8096);
  });

  it("prices staff with contributions on top", () => {
    expect(staffLine({ id: "x", role: "Lead", type: "FT", count: "1", hours: "100", rate: "20", ins: "10" })).toEqual({
      gross: 2000,
      ins: 200,
      count: 1,
      total: 2200,
    });
  });
});

describe("the old cup price", () => {
  const supplies = [
    { id: "beans", label: "Coffee beans", qty: "40", unit: "kg", price: "22" },
    { id: "cups", label: "To-go cups", qty: "3000", unit: "pcs", price: "0.11" },
  ];

  it("costs a cup from its recipe, adds the margin on cost, then VAT", () => {
    const c = cupCost(
      month({
        supplies,
        cup: {
          recipe: [
            { id: "r1", supplyId: "beans", qty: "0.018" },
            { id: "r2", supplyId: "cups", qty: "1" },
          ],
          margin: "100",
          vat: "25",
        },
      }),
    );
    expect(c.ingredients).toBeCloseTo(0.396 + 0.11);
    expect(c.price).toBeCloseTo(2 * 0.506);
    expect(c.priceInclVat).toBeCloseTo(2 * 0.506 * 1.25);
  });

  it("ignores a recipe line whose supply was removed", () => {
    const c = cupCost(month({ supplies, cup: { recipe: [{ id: "r", supplyId: "gone", qty: "1" }], margin: "0", vat: "" } }));
    expect(c.ingredients).toBe(0);
  });

});

describe("break-even and profit", () => {
  const plain = month({
    days: "25",
    coffeesPerCustomer: "2",
    foodPerCustomer: "1",
    supplies: [{ id: "cups", label: "Cups", qty: "1", unit: "pcs", price: "1" }],
    cup: { recipe: [{ id: "r", supplyId: "cups", qty: "1" }], margin: "100", vat: "25" },
  });
  /** The old cup's month, plus a snack at 1.10 with 10% VAT */
  const snack = { ...plain.menu.drinks[0], id: "s", kind: "food" as const, name: "Snack", price: "1.10", vat: "10" };
  const m = { ...plain, menu: { ...plain.menu, drinks: [...plain.menu.drinks, snack] } };

  it("prices drinks from the menu: the old cup recipe's month gets the same answer", () => {
    // No menu saved: the month's menu is one drink at the old cup price, 2.50, with its 25% VAT.
    expect(plain.menu.drinks.map((d) => d.price)).toEqual(["2.50"]);
    expect(breakEven(m, 10_000).cupPrice).toBeCloseTo(2.5);
    // With cups sold, the average is weighted by them; without, it's the plain average.
    const two = (cups: [string, string]) =>
      month({ menu: { ...m.menu, drinks: [{ ...m.menu.drinks[0], price: "2", cups: cups[0] }, { ...m.menu.drinks[0], id: "b", price: "4", cups: cups[1] }] } });
    expect(averageDrink(two(["300", "100"])).price).toBeCloseTo(2.5);
    expect(averageDrink(two(["", ""])).price).toBeCloseTo(3);
  });

  it("takes each drink's own VAT out: take-away and sit-in at different rates", () => {
    const drinks = [
      { ...m.menu.drinks[0], price: "2.22", vat: "11", cups: "100" }, // 2.00 without VAT
      { ...m.menu.drinks[0], id: "b", price: "2.50", vat: "", cups: "100" }, // the menu's 25%: 2.00
      snack,
    ];
    const mixed = { ...m, menu: { ...m.menu, drinks } };
    expect(averageDrink(mixed)).toEqual({ price: expect.closeTo(2.36), net: expect.closeTo(2) });
    const be = breakEven(mixed, 10_000);
    // Two drinks at 2.00 without VAT, and a 1.10 snack incl. 10% VAT: 5.00 a customer, as for the single cup.
    expect(be.avg).toBeCloseTo(5);
    expect(be.vat).toBeCloseTo(0.18);
    expect(be.customersDay).toBe(80);
  });

  it("averages drinks and food apart", () => {
    const croissant = { ...snack, id: "f", price: "9.00" };
    const withFood = { ...m, menu: { ...m.menu, drinks: [...m.menu.drinks, croissant] } };
    expect(averageDrink(withFood).price).toBeCloseTo(2.5);
    expect(averageDrink(withFood, "food").price).toBeCloseTo((1.1 + 9) / 2);
  });

  it("works out food per customer from what the menu sells, unless typed in", () => {
    const sold = (drinkCups: string, foodCups: string) => ({
      ...m,
      foodPerCustomer: "",
      menu: { ...m.menu, drinks: [{ ...m.menu.drinks[0], cups: drinkCups }, { ...snack, cups: foodCups }] },
    });
    // 300 snacks for 1,200 drinks: one for every four drinks, so half a snack for a customer's two drinks
    const be = breakEven(sold("1200", "300"), 10_000);
    expect(be).toMatchObject({ foodFromMenu: true, drinksSold: 1200, foodSold: 300 });
    expect(be.foodItems).toBeCloseTo(0.5);
    expect(be.extras).toBeCloseTo(0.55);
    expect(be.avg).toBeCloseTo(4 + 0.5);
    expect(breakEven(sold("", ""), 10_000).foodItems).toBe(0);
    expect(breakEven({ ...sold("1200", "300"), foodPerCustomer: "1" }, 10_000)).toMatchObject({ foodFromMenu: false, foodItems: 1 });
  });

  it("gives food the menu's food VAT, else the drinks'", () => {
    const croissant = { ...m.menu.drinks[0], kind: "food" as const, vat: "" };
    expect(drinkVat(m, croissant)).toBeCloseTo(0.25);
    expect(drinkVat({ menu: { ...m.menu, foodVat: "12" } }, croissant)).toBeCloseTo(0.12);
    expect(drinkVat({ menu: { ...m.menu, foodVat: "12" } }, m.menu.drinks[0])).toBeCloseTo(0.25);
    expect(drinkVat({ menu: { ...m.menu, foodVat: "12" } }, { ...croissant, vat: "6" })).toBeCloseTo(0.06);
  });

  it("takes VAT out of each part of the sale at its own rate", () => {
    const be = breakEven(m, 10_000);
    // Two coffees at 2.50 incl. VAT, and a 1.10 snack incl. 10% VAT.
    expect(be.avgGross).toBeCloseTo(6.1);
    expect(be.avg).toBeCloseTo(4 + 1);
    expect(be.extrasVat).toBeCloseTo(0.1);
    expect(be.customersMonth).toBe(2000);
    expect(be.customersDay).toBe(80);
    expect(be.perDay).toBe(400);
    // 400 a day of costs, with VAT on top at the sale's mix: 400 × 6.10 ÷ 5.00
    expect(be.tillPerDay).toBeCloseTo(488);
  });

  it("has no profit until sales are entered", () => {
    expect(profitOf(m, 10_000)).toBeNull();
    const p = profitOf({ ...m, revenue: "12,500" }, 10_000)!;
    expect(p.profit).toBe(2500);
    expect(p.margin).toBeCloseTo(0.2);
    expect(p.coverage).toBeCloseTo(1.25);
  });
});

describe("withDefaults", () => {
  it("fills in fields added after a month was saved", () => {
    const old = { premises: [], utilities: [], supplies: [], staff: [], other: [], days: "30" } as unknown as MonthData;
    const m = withDefaults(old);
    expect(m.consumables).toEqual([]);
    expect(m.revenue).toBe("");
    expect(m.cup.recipe).toEqual([]);
    expect(m.consumablePricing.margin).toBe("150");
    expect(m.takings).toEqual({});
  });

  it("makes drinks of a menu saved before food", () => {
    const old = sampleMonth() as unknown as { menu: Record<string, unknown> & { drinks: Record<string, unknown>[] } };
    delete old.menu.foodVat;
    old.menu.drinks.forEach((d) => delete d.kind);
    const m = withDefaults(old as unknown as MonthData);
    expect(m.menu.foodVat).toBe("");
    expect(m.menu.drinks.every((d) => d.kind === "drink")).toBe(true);
  });

  it("keeps the sample month valid", () => {
    expect(computeTotals(sampleMonth()).total).toBeGreaterThan(0);
  });
});
