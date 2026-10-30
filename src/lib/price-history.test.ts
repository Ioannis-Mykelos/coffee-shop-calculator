import { describe, expect, it } from "vitest";
import { nextMonth, sampleMonth, type SupplyItem } from "./expenses";
import { dayKey, HISTORY_LIMIT, lastPriceChange, recordPriceChange } from "./price-history";
import { cleanMonth } from "./workspace";

const milk = (): SupplyItem => ({ id: "m", label: "Milk", qty: "100", unit: "L", price: "1.20" });

describe("recordPriceChange", () => {
  it("saves the date, the old price and the new price", () => {
    const item = milk();
    recordPriceChange(item, "1.20", "1.35", "2026-10-30");
    expect(item.priceHistory).toEqual([{ date: "2026-10-30", from: "1.20", to: "1.35" }]);
  });

  it("adds later changes after earlier ones", () => {
    const item = milk();
    recordPriceChange(item, "1.20", "1.35", "2026-10-01");
    recordPriceChange(item, "1.35", "1.30", "2026-11-01");
    expect(item.priceHistory?.map((c) => c.to)).toEqual(["1.35", "1.30"]);
  });

  it("ignores a first price, a cleared field and the same price typed differently", () => {
    const item = milk();
    recordPriceChange(item, "", "1.20", "2026-10-30");
    recordPriceChange(item, "1.20", "", "2026-10-30");
    recordPriceChange(item, "1.20", "1,2", "2026-10-30");
    expect(item.priceHistory).toBeUndefined();
  });

  it("counts corrections on one day as one change, and undoing it leaves nothing", () => {
    const item = milk();
    recordPriceChange(item, "1.20", "13.5", "2026-10-30");
    recordPriceChange(item, "13.5", "1.35", "2026-10-30");
    expect(item.priceHistory).toEqual([{ date: "2026-10-30", from: "1.20", to: "1.35" }]);
    recordPriceChange(item, "1.35", "1.20", "2026-10-30");
    expect(item.priceHistory).toEqual([]);
  });

  it("keeps only the latest changes", () => {
    const item = milk();
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) recordPriceChange(item, String(i), String(i + 1), `2026-01-${i}`);
    expect(item.priceHistory).toHaveLength(HISTORY_LIMIT);
    expect(item.priceHistory?.at(-1)?.to).toBe(String(HISTORY_LIMIT + 6));
  });
});

describe("lastPriceChange", () => {
  it("is null for a price that has never changed", () => {
    expect(lastPriceChange(milk())).toBeNull();
    expect(lastPriceChange({ ...milk(), priceHistory: [] })).toBeNull();
  });

  it("gives the latest change in %, up or down", () => {
    const item = milk();
    recordPriceChange(item, "1.00", "1.12", "2026-10-01");
    expect(lastPriceChange(item)?.percent).toBeCloseTo(12);
    recordPriceChange(item, "1.12", "0.84", "2026-11-01");
    expect(lastPriceChange(item)?.percent).toBeCloseTo(-25);
  });
});

describe("dayKey", () => {
  it("pads the month and day", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("price history over time", () => {
  const withHistory = () => {
    const m = sampleMonth();
    recordPriceChange(m.supplies[0], "1.00", "1.10", "2026-10-30");
    recordPriceChange(m.consumables[0], "2.00", "1.80", "2026-10-30");
    return m;
  };

  it("carries into a new month, which then keeps its own copy", () => {
    const october = withHistory();
    const november = nextMonth(october);
    expect(november.supplies[0].priceHistory).toEqual(october.supplies[0].priceHistory);
    expect(november.consumables[0].priceHistory).toEqual(october.consumables[0].priceHistory);
    recordPriceChange(november.supplies[0], "1.10", "1.20", "2026-11-02");
    expect(october.supplies[0].priceHistory).toHaveLength(1);
    expect(november.supplies[0].priceHistory).toHaveLength(2);
  });

  it("survives being saved and loaded", () => {
    const month = withHistory();
    const saved = cleanMonth(JSON.parse(JSON.stringify(month)))!;
    expect(saved.supplies[0].priceHistory).toEqual([{ date: "2026-10-30", from: "1.00", to: "1.10" }]);
    expect(saved.consumables[0].priceHistory).toEqual([{ date: "2026-10-30", from: "2.00", to: "1.80" }]);
  });

  it("drops anything in a saved history that isn't a price change", () => {
    const month = JSON.parse(JSON.stringify(sampleMonth()));
    month.supplies[0].priceHistory = [
      { date: "2026-10-30", from: "1", to: "2", evil: true },
      { date: "yesterday", from: "1", to: "2" },
      "junk",
      ...Array.from({ length: HISTORY_LIMIT + 5 }, () => ({ date: "2026-10-30", from: "1", to: "2" })),
    ];
    const saved = cleanMonth(month)!.supplies[0].priceHistory!;
    expect(saved).toHaveLength(HISTORY_LIMIT);
    expect(saved.every((c) => Object.keys(c).length === 3 && c.date === "2026-10-30")).toBe(true);
  });
});
