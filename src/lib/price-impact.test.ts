import { describe, expect, it } from "vitest";
import { type MonthData, sampleMonth } from "./expenses";
import { percentLabel, recordPriceChange } from "./price-history";
import { impactSentence, priceImpact } from "./price-impact";

/** The sample café after a supply's price went from what it was to `to`. */
function changed(label: string, to: string, list: "supplies" | "consumables" = "supplies"): { m: MonthData; id: string } {
  const m = sampleMonth();
  const item = m[list].find((s) => s.label === label)!;
  recordPriceChange(item, item.price, to, "2026-10-30");
  item.price = to;
  return { m, id: item.id };
}

describe("priceImpact", () => {
  it("names the menu items made with the supply, the lowest margin first", () => {
    const { m, id } = changed("Milk", "1.46");
    const impact = priceImpact(m, id)!;
    expect(impact.label).toBe("Milk");
    expect(impact.percent).toBeCloseTo(12.3, 1);
    const withMilk = m.menu.drinks.filter((d) => d.recipe.some((r) => r.supplyId === id));
    expect(impact.items.map((i) => i.id).sort()).toEqual(withMilk.map((d) => d.id).sort());
    expect(impact.items.map((i) => i.marginPct)).toEqual([...impact.items.map((i) => i.marginPct)].sort((a, b) => a - b));
  });

  it("works out the new margin from the new price and the old one from the old price", () => {
    const { m, id } = changed("Coffee beans", "33");
    const espresso = priceImpact(m, id)!.items.find((i) => i.name === "Espresso")!;
    // 2.80 ÷ 1.25 = 2.24 net. Cost 0.018 kg × 22 + 0.11 + 0.05 = 0.556, then 0.018 × 33 + 0.16 = 0.754
    expect(espresso.marginBefore).toBeCloseTo((2.24 - 0.556) / 2.24);
    expect(espresso.marginPct).toBeCloseTo((2.24 - 0.754) / 2.24);
  });

  it("covers consumables too", () => {
    const { m, id } = changed("Overnight pudding", "1.2", "consumables");
    expect(priceImpact(m, id)!.items.map((i) => i.name)).toEqual(["Overnight pudding"]);
  });

  it("flags items that fall below the target margin", () => {
    const { m, id } = changed("Coffee beans", "33");
    m.menu.target = "99";
    expect(priceImpact(m, id)!.items.every((i) => i.belowTarget)).toBe(true);
    m.menu.target = "1";
    expect(priceImpact(m, id)!.items.some((i) => i.belowTarget)).toBe(false);
  });

  it("leaves out items with no price", () => {
    const { m, id } = changed("Coffee beans", "33");
    const espresso = m.menu.drinks.find((d) => d.name === "Espresso")!;
    espresso.price = "";
    expect(priceImpact(m, id)!.items.map((i) => i.name)).not.toContain("Espresso");
  });

  it("is null without a price change, for an item not on the menu, and for an unknown id", () => {
    const m = sampleMonth();
    expect(priceImpact(m, m.supplies[0].id)).toBeNull();
    const napkins = changed("Napkins & stirrers", "50");
    expect(priceImpact(napkins.m, napkins.id)).toBeNull();
    expect(priceImpact(m, "nope")).toBeNull();
  });
});

describe("impactSentence", () => {
  const items = [
    { id: "a", name: "Caffè latte", marginPct: 0.584, marginBefore: 0.6, belowTarget: false },
    { id: "b", name: "Cappuccino", marginPct: 0.61, marginBefore: 0.63, belowTarget: false },
  ];

  it("reads like the plan's example", () => {
    expect(impactSentence({ label: "Milk", percent: 12, items: items.slice(0, 1) })).toBe("Milk up 12%: Caffè latte margin is now 58%");
  });

  it("lists several items, and says when a price went down", () => {
    expect(impactSentence({ label: "Milk", percent: -4.5, items })).toBe("Milk down 4.5%: Caffè latte margin is now 58%, Cappuccino 61%");
  });
});

describe("percentLabel", () => {
  it("rounds, keeping one decimal under 10%", () => {
    expect(percentLabel(12.3)).toBe("12%");
    expect(percentLabel(-4.55)).toBe("4.6%");
    expect(percentLabel(9.999)).toBe("10%");
    expect(percentLabel(0.04)).toBe("0%");
  });
});
