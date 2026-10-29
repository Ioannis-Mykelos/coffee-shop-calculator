import { describe, expect, it } from "vitest";
import { cupCost, type Drink, type MonthData, withDefaults } from "./expenses";
import { drinkFigures, menuSummary } from "./menu";

const supplies = [
  { id: "b", label: "Coffee beans", qty: "", unit: "kg", price: "20" },
  { id: "m", label: "Milk", qty: "", unit: "L", price: "1" },
  { id: "o", label: "Oat milk", qty: "", unit: "L", price: "2" },
  { id: "c", label: "Cups", qty: "", unit: "pcs", price: "0.10" },
];
const latte: Drink = {
  id: "latte",
  kind: "drink",
  name: "Latte",
  price: "5.00",
  vat: "",
  cups: "100",
  recipe: [
    { id: "r1", supplyId: "b", qty: "0.02" },
    { id: "r2", supplyId: "m", qty: "0.2" },
    { id: "r3", supplyId: "c", qty: "1" },
  ],
};
const espresso: Drink = {
  id: "espresso",
  kind: "drink",
  name: "Espresso",
  price: "2.50",
  vat: "",
  cups: "300",
  recipe: [
    { id: "r4", supplyId: "b", qty: "0.02" },
    { id: "r5", supplyId: "c", qty: "1" },
  ],
};

function month(drinks: Drink[] = [latte, espresso]): MonthData {
  return withDefaults({
    premises: [],
    utilities: [],
    supplies,
    consumables: [],
    staff: [],
    other: [],
    days: "",
    coffeesPerCustomer: "1",
    extrasPerCustomer: "",
    revenue: "",
    cup: { recipe: [], margin: "0", vat: "" },
    consumablePricing: { margin: "0", vat: "" },
    menu: { drinks, vat: "25", foodVat: "", target: "60" },
  });
}

describe("drinkFigures", () => {
  it("prices the recipe from Supplies and takes VAT out of the menu price", () => {
    const d = drinkFigures(month(), latte);
    expect(d.cost).toBeCloseTo(0.7); // 0.02 kg × 20 + 0.2 L × 1 + 1 × 0.10
    expect(d.net).toBeCloseTo(4); // 5.00 ÷ 1.25
    expect(d.margin).toBeCloseTo(3.3);
    expect(d.marginPct).toBeCloseTo(0.825);
    expect(d.monthly).toBeCloseTo(330);
    // 0.7 ÷ (1 − 60%) = 1.75 without VAT
    expect(d.targetPrice).toBeCloseTo(2.1875);
  });

  it("uses a drink's own VAT when it has one, else the menu's", () => {
    const m = month();
    expect(drinkFigures(m, latte).vat).toBeCloseTo(0.25);
    // Take-away at 11%: 5.00 ÷ 1.11 − 0.70
    const takeAway = drinkFigures(m, { ...latte, vat: "11" });
    expect(takeAway.vat).toBeCloseTo(0.11);
    expect(takeAway.margin).toBeCloseTo(5 / 1.11 - 0.7);
    expect(takeAway.targetPrice).toBeCloseTo(1.75 * 1.11);
  });
});

describe("food", () => {
  it("is made from Consumables, at the food VAT", () => {
    const croissant: Drink = { id: "f", kind: "food", name: "", price: "3.36", vat: "", cups: "50", recipe: [{ id: "r", supplyId: "p", qty: "1" }] };
    const m = { ...month([latte, croissant]), consumables: [{ id: "p", label: "Pastries", qty: "", unit: "pcs", price: "0.80" }] };
    m.menu.foodVat = "12";
    const d = drinkFigures(m, croissant);
    expect(d).toMatchObject({ kind: "food", name: "Untitled food", cost: 0.8 });
    expect(d.lines[0].label).toBe("Pastries");
    expect(d.net).toBeCloseTo(3); // 3.36 ÷ 1.12
    expect(d.monthly).toBeCloseTo(110);
    // Ranked with the drinks: the latte keeps 330 a month
    expect(menuSummary(m).drinks.map((x) => x.id)).toEqual(["latte", "f"]);
  });
});

describe("menuSummary", () => {
  it("ranks drinks by profit a month and finds the thinnest margin", () => {
    const s = menuSummary(month());
    expect(s.drinks.map((d) => d.id)).toEqual(["espresso", "latte"]); // 450 a month against 330
    expect(s.best?.id).toBe("espresso");
    expect(s.thinnest?.id).toBe("espresso"); // 1.50 a cup against 3.30
    expect(s.cups).toBe(400);
    expect(s.profit).toBeCloseTo(780);
    expect(s.sales).toBeCloseTo(1000);
    expect(s.perCup).toBeCloseTo(1.95);
  });

  it("ranks by margin per cup when cups sold aren't known", () => {
    const s = menuSummary(month([{ ...latte, cups: "" }, { ...espresso, cups: "" }]));
    expect(s.withCups).toBe(false);
    expect(s.drinks.map((d) => d.id)).toEqual(["latte", "espresso"]);
  });
});

describe("a month saved before menus", () => {
  it("gets one drink from its cup recipe and price", () => {
    const old = {
      ...month(),
      cup: { recipe: [{ id: "x", supplyId: "b", qty: "0.02" }], margin: "100", vat: "25" },
      menu: undefined,
    };
    const m = withDefaults(old);
    expect(m.menu.drinks).toHaveLength(1);
    expect(m.menu.drinks[0]).toMatchObject({ name: "Coffee", price: cupCost(old).priceInclVat.toFixed(2), cups: "" });
    expect(m.menu.drinks[0].recipe[0]).toMatchObject({ supplyId: "b", qty: "0.02" });
    expect(m.menu.drinks[0].recipe[0].id).not.toBe("x");
    expect(m.menu).toMatchObject({ vat: "25" });
  });
});
