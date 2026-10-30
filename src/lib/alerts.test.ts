import { describe, expect, it } from "vitest";
import { type MonthData, type MonthsData, currencyFormatter, withDefaults } from "./expenses";
import { type AlertRule, monthAlerts } from "./alerts";

const fmt = currencyFormatter("EUR");

/** 2,500 of costs over 25 opening days, one espresso at 2.50 (25% VAT) with no recipe: nothing to warn about. */
function month(over: Partial<MonthData> = {}): MonthData {
  return withDefaults({
    premises: [{ id: "p", label: "Rent", amount: "2500" }],
    utilities: [],
    supplies: [{ id: "b", label: "Beans", qty: "", unit: "kg", price: "20" }],
    consumables: [],
    staff: [],
    other: [],
    days: "25",
    coffeesPerCustomer: "1",
    extrasPerCustomer: "",
    revenue: "",
    takings: {},
    cup: { recipe: [], margin: "0", vat: "" },
    consumablePricing: { margin: "0", vat: "" },
    menu: { drinks: [{ id: "e", kind: "drink", name: "Espresso", price: "2.50", vat: "", cups: "", recipe: [] }], vat: "25", foodVat: "", target: "70" },
    ...over,
  });
}

/** October 2026 starts on a Thursday, so the 12th is a Monday and the 14th a Wednesday. */
const KEY = "2026-10";
const MONDAY = new Date(2026, 9, 12);
const TUESDAY = new Date(2026, 9, 13);
const WEDNESDAY = new Date(2026, 9, 14);
const SUNDAY = new Date(2026, 9, 18);

const rules = (data: MonthsData, now = MONDAY, key = KEY) => monthAlerts(data, key, now, fmt);
const only = (rule: AlertRule, data: MonthsData, now = MONDAY) => rules(data, now).filter((a) => a.rule === rule);

describe("monthAlerts", () => {
  it("is quiet for a month that's fine, and for a month with no figures", () => {
    expect(rules({ [KEY]: month() })).toEqual([]);
    expect(rules({}, MONDAY)).toEqual([]);
  });

  describe("a drink below the target margin", () => {
    const beansIn = (target: string) =>
      month({
        menu: {
          drinks: [{ id: "e", kind: "drink", name: "Espresso", price: "2.50", vat: "", cups: "", recipe: [{ id: "r", supplyId: "b", qty: "0.05" }] }],
          vat: "25",
          foodVat: "",
          target,
        },
      });

    it("warns, naming the drink and its margin", () => {
      // 2.50 ÷ 1.25 = 2.00 net, 1.00 of beans, so 50%
      const [alert] = only("margin", { [KEY]: beansIn("70") });
      expect(alert).toMatchObject({ id: "margin:e", title: "Espresso is below your target margin" });
      expect(alert.detail).toBe("It keeps 50% against your 70% target.");
    });

    it("stays quiet at or above the target, or with no target", () => {
      expect(only("margin", { [KEY]: beansIn("50") })).toEqual([]);
      expect(only("margin", { [KEY]: beansIn("") })).toEqual([]);
    });

    it("stays quiet for a drink with no price, and for food", () => {
      const m = beansIn("70");
      m.menu.drinks[0].price = "";
      expect(only("margin", { [KEY]: m })).toEqual([]);
      const food = beansIn("70");
      food.menu.drinks[0].kind = "food";
      expect(only("margin", { [KEY]: food })).toEqual([]);
    });
  });

  describe("behind the daily target by midweek", () => {
    // 2,500 of costs with 25% VAT over 25 days: 125 a day at the till.
    const week = (a: string, b: string, c: string) => ({ [KEY]: month({ takings: { 12: a, 13: b, 14: c } }) });

    it("warns from Wednesday, with what's missing", () => {
      const [alert] = only("behind", week("100", "100", "100"), WEDNESDAY);
      expect(alert.id).toBe("behind:2026-10-12");
      expect(alert.detail).toBe(`${fmt(75)} short after 3 days, against ${fmt(125)} a day.`);
    });

    it("keeps warning to the end of the week", () => {
      expect(only("behind", week("100", "100", "100"), SUNDAY)).toHaveLength(1);
    });

    it("stays quiet on Monday and Tuesday", () => {
      expect(only("behind", week("1", "1", ""), MONDAY)).toEqual([]);
      expect(only("behind", week("1", "1", ""), TUESDAY)).toEqual([]);
    });

    it("stays quiet on target, or with nothing logged this week", () => {
      expect(only("behind", week("125", "125", "125"), WEDNESDAY)).toEqual([]);
      expect(only("behind", week("100", "150", "125"), WEDNESDAY)).toEqual([]);
      expect(only("behind", { [KEY]: month({ takings: { 5: "1" } }) }, WEDNESDAY)).toEqual([]);
    });

    it("only counts days logged, not days left blank", () => {
      const [alert] = only("behind", week("100", "", ""), WEDNESDAY);
      expect(alert.detail).toBe(`${fmt(25)} short after 1 day, against ${fmt(125)} a day.`);
    });

    it("stays quiet about any month but the current one", () => {
      expect(rules(week("1", "1", "1"), new Date(2026, 10, 18)).filter((a) => a.rule === "behind")).toEqual([]);
    });
  });

  describe("costs up on last month", () => {
    const costs = (amount: string) => month({ premises: [{ id: "p", label: "Rent", amount }] });

    it("warns when costs rise by more than 10%", () => {
      const [alert] = only("costs", { "2026-09": costs("1000"), [KEY]: costs("1101") });
      expect(alert.title).toBe("Costs are up 10% on last month");
      expect(alert.detail).toBe(`${fmt(1101)} this month against ${fmt(1000)} last month.`);
    });

    it("stays quiet at 10% or less, and when they fall", () => {
      expect(only("costs", { "2026-09": costs("1000"), [KEY]: costs("1100") })).toEqual([]);
      expect(only("costs", { "2026-09": costs("1000"), [KEY]: costs("900") })).toEqual([]);
    });

    it("stays quiet with no last month, or an empty one", () => {
      expect(only("costs", { [KEY]: costs("1000") })).toEqual([]);
      expect(only("costs", { "2026-09": costs("0"), [KEY]: costs("1000") })).toEqual([]);
    });
  });

  describe("staff cost too high", () => {
    const staffed = (revenue: string) =>
      month({ revenue, staff: [{ id: "s", role: "Barista", type: "FT", count: "1", hours: "100", rate: "10", ins: "" }] });

    it("warns above the healthy range", () => {
      const [alert] = only("staff", { [KEY]: staffed("2000") });
      expect(alert.id).toBe("staff");
      expect(alert.detail).toBe("It takes 50% of sales; cafés usually run at 25%–35%.");
    });

    it("stays quiet within or below the range, or with no sales", () => {
      expect(only("staff", { [KEY]: staffed("3000") })).toEqual([]);
      expect(only("staff", { [KEY]: staffed("9000") })).toEqual([]);
      expect(only("staff", { [KEY]: staffed("") })).toEqual([]);
    });
  });
});
